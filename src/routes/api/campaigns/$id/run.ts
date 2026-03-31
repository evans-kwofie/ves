import { createFileRoute } from "@tanstack/react-router";
import { getCampaign, getCampaignLeadsWithData, updateCampaignLastRun } from "~/db/queries/campaigns";
import { buildCampaignPrompt, buildSystemPrompt } from "~/agent/prompts";
import { runAgent } from "~/agent/agent";
import { auth } from "~/lib/auth";
import { getRequestHeaders } from "@tanstack/react-start/server";
import type { AgentVoiceConfig } from "~/routes/$workspaceId/settings/agent";

const runningCampaigns = new Set<string>();

export const Route = createFileRoute("/api/campaigns/$id/run")({
  server: {
    handlers: {
      POST: async ({ params }) => {
        const { id } = params;

        if (runningCampaigns.has(id)) {
          return new Response(JSON.stringify({ error: "campaign_already_running" }), {
            status: 409,
            headers: { "Content-Type": "application/json" },
          });
        }

        const campaign = await getCampaign(id);
        if (!campaign) {
          return new Response(JSON.stringify({ error: "not_found" }), {
            status: 404,
            headers: { "Content-Type": "application/json" },
          });
        }

        const leads = await getCampaignLeadsWithData(id);
        if (leads.length === 0) {
          return new Response(JSON.stringify({ error: "no_leads", message: "Add leads to this campaign before running it." }), {
            status: 400,
            headers: { "Content-Type": "application/json" },
          });
        }

        // Load org voice config
        let voice: Partial<AgentVoiceConfig> = {};
        try {
          const headers = getRequestHeaders();
          const orgs = await auth.api.listOrganizations({ headers });
          const org = orgs?.find((o) => o.id === campaign.organizationId);
          if (org?.metadata) {
            const meta = JSON.parse(org.metadata as string) as Record<string, string>;
            if (meta.agentVoice) voice = JSON.parse(meta.agentVoice) as Partial<AgentVoiceConfig>;
          }
        } catch { /* use defaults */ }

        const prompt = buildCampaignPrompt(campaign, leads);

        runningCampaigns.add(id);
        try {
          const logs = await runAgent(prompt, {
            maxIterations: 40,
            orgId: campaign.organizationId,
            voice,
          });
          await updateCampaignLastRun(id);
          return Response.json({ ok: true, logs });
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          return new Response(JSON.stringify({ error: message }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
          });
        } finally {
          runningCampaigns.delete(id);
        }
      },

      GET: async ({ params }) => {
        return Response.json({ running: runningCampaigns.has(params.id) });
      },
    },
  },
});
