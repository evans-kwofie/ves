import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { getCampaign, updateCampaign, deleteCampaign } from "~/db/queries/campaigns";

const updateSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  status: z.enum(["draft", "active", "scheduled", "completed"]).optional(),
  channel: z.enum(["email", "linkedin", "both"]).optional(),
  goal: z.string().optional(),
  runFrequency: z.enum(["daily", "every_3_days", "weekly"]).nullable().optional(),
});

export const Route = createFileRoute("/api/campaigns/$id")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const campaign = await getCampaign(params.id);
        if (!campaign) return new Response(JSON.stringify({ error: "not_found" }), { status: 404, headers: { "Content-Type": "application/json" } });
        return Response.json(campaign);
      },
      PUT: async ({ request, params }) => {
        let body: unknown;
        try { body = await request.json(); } catch {
          return new Response(JSON.stringify({ error: "invalid_json" }), { status: 400, headers: { "Content-Type": "application/json" } });
        }
        const parsed = updateSchema.safeParse(body);
        if (!parsed.success) return new Response(JSON.stringify({ error: parsed.error.flatten() }), { status: 422, headers: { "Content-Type": "application/json" } });
        const campaign = await updateCampaign(params.id, parsed.data);
        return Response.json(campaign);
      },
      DELETE: async ({ params }) => {
        await deleteCampaign(params.id);
        return Response.json({ ok: true });
      },
    },
  },
});
