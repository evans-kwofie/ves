/**
 * Handles outbound email event webhooks from Resend (delivered, bounced, etc.).
 *
 * Setup:
 * 1. In Resend dashboard → Webhooks → add endpoint pointing to /api/webhooks/resend.
 * 2. Subscribe to: email.bounced, email.complained, email.delivered (optional).
 * 3. Copy the signing secret from Resend into RESEND_WEBHOOK_SECRET env var.
 *
 * Resend signs webhooks using Svix. We verify the signature before processing.
 */

import { createFileRoute } from "@tanstack/react-router";
import { Webhook } from "svix";
import { getDraftByResendMessageId } from "~/db/queries/drafts";
import { getLead, updateLead } from "~/db/queries/leads";

interface ResendEmailEvent {
  type: string;
  created_at: string;
  data: {
    email_id: string;
    from?: string;
    to?: string[];
    subject?: string;
    created_at?: string;
    tags?: Record<string, string>[];
  };
}

export const Route = createFileRoute("/api/webhooks/resend")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = process.env.RESEND_WEBHOOK_SECRET;
        if (!secret) {
          console.error("[webhook/resend] RESEND_WEBHOOK_SECRET not set");
          return new Response(JSON.stringify({ error: "misconfigured" }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
          });
        }

        const payload = await request.text();
        const svixId = request.headers.get("svix-id") ?? "";
        const svixTimestamp = request.headers.get("svix-timestamp") ?? "";
        const svixSignature = request.headers.get("svix-signature") ?? "";

        let event: ResendEmailEvent;
        try {
          const wh = new Webhook(secret);
          event = wh.verify(payload, {
            "svix-id": svixId,
            "svix-timestamp": svixTimestamp,
            "svix-signature": svixSignature,
          }) as ResendEmailEvent;
        } catch (err) {
          console.warn("[webhook/resend] Signature verification failed:", err);
          return new Response(JSON.stringify({ error: "invalid_signature" }), {
            status: 401,
            headers: { "Content-Type": "application/json" },
          });
        }

        const { type, data } = event;
        console.log(`[webhook/resend] event=${type} email_id=${data.email_id}`);

        if (type === "email.bounced" || type === "email.complained") {
          const draft = await getDraftByResendMessageId(data.email_id);
          if (draft) {
            const lead = await getLead(draft.leadId);
            if (lead && lead.status === "email_sent") {
              await updateLead(lead.id, { status: "not_contacted" });
              console.log(`[webhook/resend] Marked lead ${lead.id} as not_contacted due to ${type}`);
            }
          }
        }

        return Response.json({ ok: true, type });
      },
    },
  },
});
