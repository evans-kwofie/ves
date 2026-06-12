/**
 * In-process scheduler that periodically generates content for
 * follow-up drafts whose send_after date has passed.
 * Runs every hour inside the Node.js server process.
 */
import { getDueCampaignSteps, listDrafts } from "~/db/queries/drafts";
import { getCampaign, getCampaignLeadsWithData } from "~/db/queries/campaigns";
import { listSteps } from "~/db/queries/steps";
import { generateDraftForLead } from "~/agent/tools/draft-content";
import { db } from "~/db/client";

async function getOrgProfile(orgId: string): Promise<Record<string, unknown>> {
  try {
    const result = await db.execute({
      sql: "SELECT metadata FROM organization WHERE id = ?",
      args: [orgId],
    });
    if (result.rows.length === 0) return {};
    const raw = (result.rows[0] as Record<string, unknown>).metadata;
    if (!raw) return {};
    return JSON.parse(raw as string) as Record<string, unknown>;
  } catch {
    return {};
  }
}

const INTERVAL_MS = 60 * 60 * 1000; // 1 hour

let started = false;

export function startDraftScheduler() {
  if (started) return;
  started = true;

  async function tick() {
    try {
      const dueSteps = await getDueCampaignSteps();
      if (dueSteps.length === 0) return;

      console.log(`[draft-scheduler] ${dueSteps.length} step(s) due — generating drafts`);

      for (const { campaignId, stepNumber } of dueSteps) {
        const campaign = await getCampaign(campaignId);
        if (!campaign) continue;

        const steps = await listSteps(campaignId);
        const step = steps.find((s) => s.stepNumber === stepNumber);
        if (!step) continue;

        const scheduledDrafts = await listDrafts(campaignId, { stepNumber, status: "scheduled" });
        const now = new Date().toISOString();
        const dueLeadIds = new Set(
          scheduledDrafts
            .filter((d) => !d.sendAfter || d.sendAfter <= now)
            .map((d) => d.leadId),
        );

        const allLeads = await getCampaignLeadsWithData(campaignId);
        const leads = allLeads.filter((l) => dueLeadIds.has(l.id) && !l.repliedAt);

        const orgProfile = await getOrgProfile(campaign.organizationId);

        for (const lead of leads) {
          try {
            await generateDraftForLead({ campaign, lead, step, orgProfile });
            console.log(`[draft-scheduler] Generated: campaign=${campaignId} step=${stepNumber} lead=${lead.id}`);
          } catch (err) {
            console.error(`[draft-scheduler] Failed: campaign=${campaignId} step=${stepNumber} lead=${lead.id}`, err);
          }
        }
      }
    } catch (err) {
      console.error("[draft-scheduler] tick error:", err);
    }
  }

  // Run once shortly after startup, then every hour
  setTimeout(() => {
    void tick();
    setInterval(() => void tick(), INTERVAL_MS);
  }, 30_000); // 30s delay on startup so DB is fully ready

  console.log("[draft-scheduler] Started — runs every hour");
}
