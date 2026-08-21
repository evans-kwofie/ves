/**
 * Handles inbound email replies forwarded by Resend Inbound Email.
 *
 * Setup:
 * 1. In Resend dashboard, add a domain under "Inbound" and point MX records to Resend.
 * 2. Create an inbound route that matches reply+*@{INBOUND_EMAIL_DOMAIN} → POST here.
 * 3. Set INBOUND_WEBHOOK_SECRET to the secret you configure in Resend for this route.
 * 4. When sending outbound emails, we already set replyTo: reply+{leadId}@{INBOUND_EMAIL_DOMAIN}.
 *
 * When a lead replies, Resend parses the email and POSTs the payload here.
 * We extract the leadId from the `to` address and mark the lead as replied.
 */

import { createFileRoute } from "@tanstack/react-router";
import { getLead, updateLead, createOutreachEvent } from "~/db/queries/leads";
import { getDraftByResendMessageId, skipScheduledDraftsForLead } from "~/db/queries/drafts";
import { notifyReply } from "~/lib/slack-notifications";
import { routeInboundReply } from "~/agent/reply-router";

function extractLeadId(toAddress: string): string | null {
  // Parses reply+{leadId}@domain → leadId
  const match = toAddress.match(/reply\+([^@]+)@/i);
  return match?.[1] ?? null;
}

function parseToAddresses(to: unknown): string[] {
  if (typeof to === "string") return [to];
  if (Array.isArray(to)) return to.filter((t) => typeof t === "string");
  return [];
}

export const Route = createFileRoute("/api/webhooks/email-inbound")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        // Verify shared secret if configured
        const secret = process.env.INBOUND_WEBHOOK_SECRET;
        if (secret) {
          const authHeader = request.headers.get("authorization") ?? "";
          const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
          if (token !== secret) {
            return new Response(JSON.stringify({ error: "unauthorized" }), {
              status: 401,
              headers: { "Content-Type": "application/json" },
            });
          }
        }

        let payload: Record<string, unknown>;
        try {
          payload = (await request.json()) as Record<string, unknown>;
        } catch {
          return new Response(JSON.stringify({ error: "invalid_json" }), {
            status: 400,
            headers: { "Content-Type": "application/json" },
          });
        }

        const toAddresses = parseToAddresses(payload.to);
        const inReplyTo = (payload.inReplyTo ?? payload.in_reply_to ?? payload.messageId ?? payload.message_id) as string | undefined;

        // Find the leadId from any tagged reply+{leadId}@domain address in the `to` field
        let leadId: string | null = null;
        for (const addr of toAddresses) {
          leadId = extractLeadId(addr);
          if (leadId) break;
        }

        if (!leadId) {
          console.warn("[email-inbound] Could not extract leadId from to:", toAddresses);
          return Response.json({ ok: true, skipped: true, reason: "no_lead_id" });
        }

        const lead = await getLead(leadId);
        if (!lead) {
          console.warn("[email-inbound] Lead not found:", leadId);
          return Response.json({ ok: true, skipped: true, reason: "lead_not_found" });
        }

        const messageText = String(payload.text ?? payload.body ?? payload.html ?? "").toLowerCase();
        const isUnsubscribe = /\bunsubscribe\b|\bremove me\b|\bremove my (email|address)\b|\btake me off\b|\bstop (emailing|sending)\b|\bdo not contact\b|\bdon't contact\b|\bcease (contact|email)\b/.test(messageText);

        // Idempotent for ordinary replies; an unsubscribe must still be honoured.
        if (lead.repliedAt && !isUnsubscribe) {
          return Response.json({ ok: true, skipped: true, reason: "already_replied" });
        }

        const now = new Date().toISOString();

        // Try to find the originating draft for campaignId
        let campaignId: string | null = null;
        if (inReplyTo) {
          const draft = await getDraftByResendMessageId(inReplyTo);
          campaignId = draft?.campaignId ?? null;
        }

        let outcome = "replied";
        let nextStatus: "replied" | "call_scheduled" | "converted" = "replied";
        if (!isUnsubscribe) {
          try {
            const routed = await routeInboundReply(messageText);
            if (routed.confidence >= 0.85 && routed.outcome === "meeting_intent") { outcome = "meeting_intent"; nextStatus = "call_scheduled"; }
            if (routed.confidence >= 0.9 && routed.outcome === "conversion_intent") { outcome = "conversion_intent"; nextStatus = "converted"; }
            if (routed.outcome === "positive_reply") outcome = "positive_reply";
            if (routed.outcome === "objection") outcome = "objection";
          } catch { /* fall back to a normal reply; never block suppression */ }
        }
        await Promise.all([
          updateLead(leadId, isUnsubscribe
            ? { optedOutAt: now, status: "not_interested" }
            : { repliedAt: now, status: nextStatus }),
          skipScheduledDraftsForLead(leadId),
          createOutreachEvent({
            leadId,
            channel: "email",
            status: isUnsubscribe ? "unsubscribed" : outcome,
            repliedAt: now,
            campaignId,
          }),
        ]);

        void notifyReply({
          orgId: lead.organizationId,
          leadName: lead.ceo || lead.company,
          company: lead.company,
          source: lead.source,
        });

        console.log(`[email-inbound] Marked lead ${leadId} as ${isUnsubscribe ? "unsubscribed" : "replied"} (campaign: ${campaignId ?? "unknown"})`);
        return Response.json({ ok: true, leadId, unsubscribed: isUnsubscribe, outcome });
      },
    },
  },
});
