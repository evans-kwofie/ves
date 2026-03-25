import { createFileRoute } from "@tanstack/react-router";
import { runAgent, DAILY_PROMPT } from "~/agent";
import { initDb } from "~/db/schema";

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

        await initDb();

        let body: unknown = {};
        try {
          body = await request.json();
        } catch {
          body = {};
        }

        const parsed = body as Record<string, unknown>;
        const mode = parsed?.mode === "daily" ? "daily" : "custom";
        const prompt = mode === "daily" ? DAILY_PROMPT : String(parsed?.prompt ?? "").trim();

        if (!prompt) {
          return new Response(JSON.stringify({ error: "prompt_required" }), {
            status: 400,
            headers: { "Content-Type": "application/json" },
          });
        }

        isRunning = true;
        try {
          const logs = await runAgent(prompt, { maxIterations: 30 });
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
