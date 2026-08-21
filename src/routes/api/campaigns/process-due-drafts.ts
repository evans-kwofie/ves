import { createFileRoute } from "@tanstack/react-router";
import { claimDueScheduledDrafts, getDueCampaignSteps, recoverStaleDraftGenerationClaims, releaseDraftGenerationClaim, updateDraft } from "~/db/queries/drafts";
import { getCampaign, getCampaignLeadsWithData } from "~/db/queries/campaigns";
import { listSteps } from "~/db/queries/steps";
import { auth } from "~/lib/auth";
import { getRequestHeaders } from "@tanstack/react-start/server";
import { generateDraftForLead } from "~/agent/tools/draft-content";
import { listProductProfiles } from "~/db/queries/products";

let processingDueDrafts = false;

export const Route = createFileRoute("/api/campaigns/process-due-drafts")({
  server: {
    handlers: {
      /** GET — check status and how many steps are due */
      GET: async () => {
        const due = await getDueCampaignSteps();
        return Response.json({ processingDueDrafts, dueSteps: due.length, steps: due });
      },

      /**
       * POST — process all due scheduled drafts across all campaigns.
       * For each (campaign, step) pair that has a scheduled draft with send_after <= now,
       * generate AI content and move it to 'pending' status for user review.
       * Call this endpoint on a regular cron schedule (e.g. hourly).
       */
      POST: async () => {
        if (processingDueDrafts) {
          return new Response(JSON.stringify({ error: "already_running" }), {
            status: 409,
            headers: { "Content-Type": "application/json" },
          });
        }

        const recovered = await recoverStaleDraftGenerationClaims();
        const dueSteps = await getDueCampaignSteps();
        if (dueSteps.length === 0) {
          return Response.json({ ok: true, processed: 0, recovered, message: "No due drafts." });
        }

        // Load org profiles once (keyed by orgId)
        let orgProfileMap: Record<string, Record<string, string>> = {};
        try {
          const headers = getRequestHeaders();
          const orgs = await auth.api.listOrganizations({ headers });
          for (const org of orgs ?? []) {
            if (org.metadata) {
              orgProfileMap[org.id] = JSON.parse(org.metadata as string) as Record<string, string>;
            }
          }
        } catch { /* use empty profiles */ }

        const results: { campaignId: string; stepNumber: number; generated: number; errors: number }[] = [];

        processingDueDrafts = true;
        try {
          for (const { campaignId, stepNumber } of dueSteps) {
            const campaign = await getCampaign(campaignId);
            if (!campaign) continue;
            if (campaign.status !== "active" && campaign.status !== "scheduled") {
              results.push({ campaignId, stepNumber, generated: 0, errors: 0 });
              continue;
            }

            const steps = await listSteps(campaignId);
            const step = steps.find((s) => s.stepNumber === stepNumber);
            if (!step) continue;

            // Find the scheduled drafts for this step that are due and get their lead IDs
            const dueDrafts = await claimDueScheduledDrafts(campaignId, stepNumber);
            const dueLeadIds = new Set(dueDrafts.map((d) => d.leadId));

            const allLeads = await getCampaignLeadsWithData(campaignId);
            const leadsToProcess = allLeads.filter((l) => dueLeadIds.has(l.id) && !l.repliedAt && !l.optedOutAt);
            const excludedLeadIds = new Set(allLeads.filter((l) => dueLeadIds.has(l.id) && (l.repliedAt || l.optedOutAt)).map((l) => l.id));
            await Promise.all(dueDrafts.filter((draft) => excludedLeadIds.has(draft.leadId)).map((draft) => updateDraft(draft.id, { status: "skipped" })));

            const orgProfile = orgProfileMap[campaign.organizationId] ?? {};
            const products = await listProductProfiles(campaign.organizationId);
            let generated = 0;
            let errors = 0;

            for (const lead of leadsToProcess) {
              const claimed = dueDrafts.find((draft) => draft.leadId === lead.id);
              try {
                await generateDraftForLead({ campaign, lead, step, orgProfile, products });
                generated++;
                console.log(`[process-due-drafts] Generated draft: campaign=${campaignId} step=${stepNumber} lead=${lead.id}`);
              } catch (err) {
                if (claimed) await releaseDraftGenerationClaim(claimed.id);
                errors++;
                console.error(`[process-due-drafts] Failed: campaign=${campaignId} step=${stepNumber} lead=${lead.id}`, err);
              }
            }

            results.push({ campaignId, stepNumber, generated, errors });
          }
        } finally {
          processingDueDrafts = false;
        }

        const totalGenerated = results.reduce((sum, r) => sum + r.generated, 0);
        return Response.json({ ok: true, processed: results.length, generated: totalGenerated, recovered, results });
      },
    },
  },
});
