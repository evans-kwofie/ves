import { createFileRoute } from "@tanstack/react-router";
import { listCampaignsDueToRun, getCampaignLeadsWithData, updateCampaignLastRun } from "~/db/queries/campaigns";
import { buildCampaignPrompt } from "~/agent/prompts";
import { runAgent } from "~/agent/agent";
import { auth } from "~/lib/auth";
import { getRequestHeaders } from "@tanstack/react-start/server";
import type { AgentVoiceConfig } from "~/routes/$workspaceId/settings/agent";

let schedulerRunning = false;

export const Route = createFileRoute("/api/campaigns/scheduler")({
  server: {
    handlers: {
      POST: async () => {
        if (schedulerRunning) {
          return new Response(JSON.stringify({ error: "scheduler_already_running" }), {
            status: 409,
            headers: { "Content-Type": "application/json" },
          });
        }

        const due = await listCampaignsDueToRun();
        if (due.length === 0) {
          return Response.json({ ok: true, ran: 0, message: "No campaigns due to run." });
        }

        // Load all org voice configs once
        let orgVoiceMap: Record<string, Partial<AgentVoiceConfig>> = {};
        try {
          const headers = getRequestHeaders();
          const orgs = await auth.api.listOrganizations({ headers });
          for (const org of orgs ?? []) {
            if (org.metadata) {
              const meta = JSON.parse(org.metadata as string) as Record<string, string>;
              if (meta.agentVoice) {
                orgVoiceMap[org.id] = JSON.parse(meta.agentVoice) as Partial<AgentVoiceConfig>;
              }
            }
          }
        } catch { /* use defaults */ }

        const results: { campaignId: string; name: string; leadsCount: number; ok: boolean; error?: string }[] = [];

        schedulerRunning = true;
        try {
          for (const campaign of due) {
            const leads = await getCampaignLeadsWithData(campaign.id);
            if (leads.length === 0) {
              results.push({ campaignId: campaign.id, name: campaign.name, leadsCount: 0, ok: false, error: "no_leads" });
              continue;
            }

            const voice = orgVoiceMap[campaign.organizationId] ?? {};
            const prompt = buildCampaignPrompt(campaign, leads);

            try {
              await runAgent(prompt, { maxIterations: 40, orgId: campaign.organizationId, voice });
              await updateCampaignLastRun(campaign.id);
              results.push({ campaignId: campaign.id, name: campaign.name, leadsCount: leads.length, ok: true });
            } catch (err) {
              const message = err instanceof Error ? err.message : String(err);
              results.push({ campaignId: campaign.id, name: campaign.name, leadsCount: leads.length, ok: false, error: message });
            }
          }
        } finally {
          schedulerRunning = false;
        }

        return Response.json({ ok: true, ran: results.filter((r) => r.ok).length, results });
      },

      GET: async () => {
        const due = await listCampaignsDueToRun();
        return Response.json({ schedulerRunning, campaignsDue: due.length });
      },
    },
  },
});
