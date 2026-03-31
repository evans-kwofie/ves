import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { addLeadToCampaign, removeLeadFromCampaign, getCampaignLeadIds } from "~/db/queries/campaigns";

const bodySchema = z.object({ leadId: z.string().min(1) });

export const Route = createFileRoute("/api/campaigns/$id/leads")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const leadIds = await getCampaignLeadIds(params.id);
        return Response.json(leadIds);
      },
      POST: async ({ request, params }) => {
        let body: unknown;
        try { body = await request.json(); } catch {
          return new Response(JSON.stringify({ error: "invalid_json" }), { status: 400, headers: { "Content-Type": "application/json" } });
        }
        const parsed = bodySchema.safeParse(body);
        if (!parsed.success) return new Response(JSON.stringify({ error: parsed.error.flatten() }), { status: 422, headers: { "Content-Type": "application/json" } });
        await addLeadToCampaign(params.id, parsed.data.leadId);
        return Response.json({ ok: true });
      },
      DELETE: async ({ request, params }) => {
        let body: unknown;
        try { body = await request.json(); } catch {
          return new Response(JSON.stringify({ error: "invalid_json" }), { status: 400, headers: { "Content-Type": "application/json" } });
        }
        const parsed = bodySchema.safeParse(body);
        if (!parsed.success) return new Response(JSON.stringify({ error: parsed.error.flatten() }), { status: 422, headers: { "Content-Type": "application/json" } });
        await removeLeadFromCampaign(params.id, parsed.data.leadId);
        return Response.json({ ok: true });
      },
    },
  },
});
