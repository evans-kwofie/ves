import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { listCampaigns, createCampaign } from "~/db/queries/campaigns";

const createSchema = z.object({
  organizationId: z.string().min(1),
  name: z.string().min(1).max(200),
  status: z.enum(["draft", "active", "paused", "scheduled", "completed"]).optional(),
  channels: z.array(z.enum(["email", "linkedin", "instagram", "reddit"])).optional(),
  goal: z.string().optional(),
  intentType: z.enum(["advice_seeking", "product_review", "audit_offer", "direct_pitch"]).optional(),
  leadIds: z.array(z.string()).optional(), scheduledStartAt: z.string().datetime().nullable().optional(),
  batchSize: z.number().int().min(1).max(500).optional(), timezone: z.string().min(1).max(100).optional(), sendWindowStart: z.number().int().min(0).max(23).optional(), sendWindowEnd: z.number().int().min(1).max(24).optional(), weekdaysOnly: z.boolean().optional(), channelSendRules: z.record(z.string(), z.unknown()).optional(),
});

export const Route = createFileRoute("/api/campaigns/")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const orgId = url.searchParams.get("organizationId");
        if (!orgId) return new Response(JSON.stringify({ error: "organizationId required" }), { status: 400, headers: { "Content-Type": "application/json" } });
        const campaigns = await listCampaigns(orgId);
        return Response.json(campaigns);
      },
      POST: async ({ request }) => {
        let body: unknown;
        try { body = await request.json(); } catch {
          return new Response(JSON.stringify({ error: "invalid_json" }), { status: 400, headers: { "Content-Type": "application/json" } });
        }
        const parsed = createSchema.safeParse(body);
        if (!parsed.success) return new Response(JSON.stringify({ error: parsed.error.flatten() }), { status: 422, headers: { "Content-Type": "application/json" } });
        const { organizationId, ...input } = parsed.data;
        const campaign = await createCampaign(organizationId, input);
        return Response.json(campaign, { status: 201 });
      },
    },
  },
});
