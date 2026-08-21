import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { listDrafts, deleteDraftsForCampaign, upsertDraft } from "~/db/queries/drafts";

const createSchema = z.object({
  leadId: z.string().min(1),
  subject: z.string().optional(),
  body: z.string().min(1),
  channel: z.enum(["email", "linkedin", "linkedin_connect", "instagram"]).default("email"),
  stepNumber: z.number().int().min(1).default(1),
});

export const Route = createFileRoute("/api/campaigns/$id/drafts")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const drafts = await listDrafts(params.id);
        return Response.json(drafts);
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
        const draft = await upsertDraft({
          campaignId: params.id,
          leadId: parsed.data.leadId,
          stepNumber: parsed.data.stepNumber,
          channel: parsed.data.channel,
          subject: parsed.data.subject ?? null,
          body: parsed.data.body,
        });
        return Response.json(draft, { status: 201 });
      },
      DELETE: async ({ params }) => {
        await deleteDraftsForCampaign(params.id);
        return Response.json({ ok: true });
      },
    },
  },
});
