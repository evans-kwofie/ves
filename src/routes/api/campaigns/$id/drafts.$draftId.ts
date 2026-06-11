import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { getDraft, updateDraft } from "~/db/queries/drafts";
import { getLead, updateLead, createOutreachEvent } from "~/db/queries/leads";
import { sendEmail } from "~/agent/tools/email";

const editSchema = z.object({
  subject: z.string().optional(),
  body: z.string().min(1).optional(),
});

export const Route = createFileRoute("/api/campaigns/$id/drafts/$draftId")({
  server: {
    handlers: {
      // Edit draft content
      PUT: async ({ params, request }) => {
        let body: unknown;
        try { body = await request.json(); } catch {
          return new Response(JSON.stringify({ error: "invalid_json" }), { status: 400, headers: { "Content-Type": "application/json" } });
        }
        const parsed = editSchema.safeParse(body);
        if (!parsed.success) {
          return new Response(JSON.stringify({ error: parsed.error.flatten() }), { status: 422, headers: { "Content-Type": "application/json" } });
        }
        const draft = await updateDraft(params.draftId, parsed.data);
        return Response.json(draft);
      },

      // Approve draft → send
      POST: async ({ params, request }) => {
        let action = "approve";
        try {
          const body = await request.json() as { action?: string };
          action = body.action ?? "approve";
        } catch { /* default approve */ }

        const draft = await getDraft(params.draftId);
        if (!draft) {
          return new Response(JSON.stringify({ error: "not_found" }), { status: 404, headers: { "Content-Type": "application/json" } });
        }

        if (action === "skip") {
          const updated = await updateDraft(params.draftId, { status: "skipped" });
          return Response.json({ ok: true, draft: updated });
        }

        // Approve: send the email
        const lead = await getLead(draft.leadId);
        if (!lead || !lead.email) {
          return new Response(JSON.stringify({ error: "lead_no_email" }), { status: 400, headers: { "Content-Type": "application/json" } });
        }

        const result = await sendEmail({
          to: lead.email,
          subject: draft.subject ?? "(no subject)",
          body: draft.body,
        });

        if (!result.success) {
          return new Response(JSON.stringify({ error: result.error ?? "send_failed" }), { status: 500, headers: { "Content-Type": "application/json" } });
        }

        const now = new Date().toISOString();
        const [updated] = await Promise.all([
          updateDraft(params.draftId, { status: "sent", sentAt: now }),
          updateLead(lead.id, { status: "email_sent", emailSentAt: now }),
          createOutreachEvent({
            leadId: lead.id,
            channel: draft.channel,
            status: "email_sent",
            sentAt: now,
            campaignId: draft.campaignId,
          }),
        ]);

        return Response.json({ ok: true, draft: updated, messageId: result.messageId });
      },
    },
  },
});
