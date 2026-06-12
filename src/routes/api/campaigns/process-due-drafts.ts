import { createFileRoute } from "@tanstack/react-router";
import { getDueCampaignSteps, listDrafts } from "~/db/queries/drafts";
import { getCampaign, getCampaignLeadsWithData } from "~/db/queries/campaigns";
import { listSteps } from "~/db/queries/steps";
import { auth } from "~/lib/auth";
import { getRequestHeaders } from "@tanstack/react-start/server";
import { generateDraftForLead } from "~/agent/tools/draft-content";

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

        const dueSteps = await getDueCampaignSteps();
        if (dueSteps.length === 0) {
          return Response.json({ ok: true, processed: 0, message: "No due drafts." });
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

            const steps = await listSteps(campaignId);
            const step = steps.find((s) => s.stepNumber === stepNumber);
            if (!step) continue;

            // Find the scheduled drafts for this step that are due and get their lead IDs
            const scheduledDrafts = await listDrafts(campaignId, { stepNumber, status: "scheduled" });
            const now = new Date().toISOString();
            const dueDrafts = scheduledDrafts.filter((d) => !d.sendAfter || d.sendAfter <= now);
            const dueLeadIds = new Set(dueDrafts.map((d) => d.leadId));

            const allLeads = await getCampaignLeadsWithData(campaignId);
            const leadsToProcess = allLeads.filter((l) => dueLeadIds.has(l.id) && !l.repliedAt);

            const orgProfile = orgProfileMap[campaign.organizationId] ?? {};
            let generated = 0;
            let errors = 0;

            for (const lead of leadsToProcess) {
              try {
                await generateDraftForLead({ campaign, lead, step, orgProfile });
                generated++;
                console.log(`[process-due-drafts] Generated draft: campaign=${campaignId} step=${stepNumber} lead=${lead.id}`);
              } catch (err) {
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
        return Response.json({ ok: true, processed: results.length, generated: totalGenerated, results });
      },
    },
  },
});
