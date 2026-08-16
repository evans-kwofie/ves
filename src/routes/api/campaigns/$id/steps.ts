import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { listSteps, createStep, updateStep, deleteStep } from "~/db/queries/steps";

const linkedinTypeSchema = z.enum(["dm", "connect"]).nullable().optional();

const createSchema = z.object({
  stepNumber: z.number().int().min(1),
  delayDays: z.number().int().min(0).default(0),
  channel: z.enum(["email", "linkedin", "instagram", "reddit"]).default("email"),
  linkedinType: linkedinTypeSchema,
  context: z.string().nullable().optional(),
});

const updateSchema = z.object({
  delayDays: z.number().int().min(0).optional(),
  channel: z.enum(["email", "linkedin", "instagram", "reddit"]).optional(),
  linkedinType: linkedinTypeSchema,
  context: z.string().nullable().optional(),
});

export const Route = createFileRoute("/api/campaigns/$id/steps")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const steps = await listSteps(params.id);
        return Response.json(steps);
      },

      POST: async ({ params, request }) => {
        let body: unknown;
        try { body = await request.json(); } catch {
          return new Response(JSON.stringify({ error: "invalid_json" }), { status: 400, headers: { "Content-Type": "application/json" } });
        }
        const parsed = createSchema.safeParse(body);
        if (!parsed.success) {
          return new Response(JSON.stringify({ error: parsed.error.flatten() }), { status: 422, headers: { "Content-Type": "application/json" } });
        }
        const step = await createStep({ campaignId: params.id, ...parsed.data });
        return Response.json(step, { status: 201 });
      },
    },
  },
});
