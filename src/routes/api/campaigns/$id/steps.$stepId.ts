import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { getStep, updateStep, deleteStep } from "~/db/queries/steps";

const updateSchema = z.object({
  delayDays: z.number().int().min(0).optional(),
  channel: z.enum(["email", "linkedin"]).optional(),
  context: z.string().nullable().optional(),
});

export const Route = createFileRoute("/api/campaigns/$id/steps/$stepId")({
  server: {
    handlers: {
      PUT: async ({ params, request }) => {
        let body: unknown;
        try { body = await request.json(); } catch {
          return new Response(JSON.stringify({ error: "invalid_json" }), { status: 400, headers: { "Content-Type": "application/json" } });
        }
        const parsed = updateSchema.safeParse(body);
        if (!parsed.success) {
          return new Response(JSON.stringify({ error: parsed.error.flatten() }), { status: 422, headers: { "Content-Type": "application/json" } });
        }
        const step = await updateStep(params.stepId, parsed.data);
        return Response.json(step);
      },

      DELETE: async ({ params }) => {
        const step = await getStep(params.stepId);
        if (!step) {
          return new Response(JSON.stringify({ error: "not_found" }), { status: 404, headers: { "Content-Type": "application/json" } });
        }
        await deleteStep(params.stepId);
        return Response.json({ ok: true });
      },
    },
  },
});
