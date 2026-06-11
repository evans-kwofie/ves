import { createFileRoute } from "@tanstack/react-router";
import { runAgent, DAILY_PROMPT } from "~/agent";
import { auth } from "~/lib/auth";
import { getRequestHeaders } from "@tanstack/react-start/server";
import type { AgentVoiceConfig } from "~/routes/$workspaceId/settings/agent";

let isRunning = false;

export const Route = createFileRoute("/api/agent/run")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        if (isRunning) {
          return new Response(JSON.stringify({ error: "agent_running" }), {
            status: 409,
            headers: { "Content-Type": "application/json" },
          });
        }


        let body: unknown = {};
        try {
          body = await request.json();
        } catch {
          body = {};
        }

        const parsed = body as Record<string, unknown>;
        const mode = parsed?.mode === "daily" ? "daily" : "custom";
        const prompt = mode === "daily" ? DAILY_PROMPT : String(parsed?.prompt ?? "").trim();
        const orgId = String(parsed?.organizationId ?? "").trim();

        if (!prompt) {
          return new Response(JSON.stringify({ error: "prompt_required" }), {
            status: 400,
            headers: { "Content-Type": "application/json" },
          });
        }

        // Load voice config from org metadata
        let voice: Partial<AgentVoiceConfig> = {};
        try {
          const headers = getRequestHeaders();
          const orgs = await auth.api.listOrganizations({ headers });
          const org = orgId ? orgs?.find((o) => o.id === orgId) : orgs?.[0];
          if (org?.metadata) {
            const meta = JSON.parse(org.metadata as string) as Record<string, string>;
            if (meta.agentVoice) voice = JSON.parse(meta.agentVoice) as Partial<AgentVoiceConfig>;
          }
        } catch { /* use defaults */ }

        isRunning = true;
        try {
          const logs = await runAgent(prompt, { maxIterations: 30, orgId, voice });
          return Response.json({ ok: true, logs });
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          return new Response(JSON.stringify({ error: message }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
          });
        } finally {
          isRunning = false;
        }
      },
      GET: async () => {
        return Response.json({ running: isRunning });
      },
    },
  },
});
