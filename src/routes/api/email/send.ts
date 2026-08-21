import { createFileRoute } from "@tanstack/react-router";
import { sendEmail } from "~/agent/tools/email";
import { verifyEmail } from "~/agent/tools/find-email";
import { getLead, updateLead } from "~/db/queries/leads";
import { recordProviderAuditEvent } from "~/db/queries/provider-audit";
import { z } from "zod";

const requestSchema = z.object({
  to: z.string().email(),
  subject: z.string().min(1),
  body: z.string().min(1),
  leadId: z.string().optional(),
  allowRiskyEmail: z.boolean().optional(),
});

export const Route = createFileRoute("/api/email/send")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        let body: unknown;
        try {
          body = await request.json();
        } catch {
          return new Response(JSON.stringify({ error: "invalid_json" }), {
            status: 400,
            headers: { "Content-Type": "application/json" },
          });
        }

        const parsed = requestSchema.safeParse(body);
        if (!parsed.success) {
          return new Response(JSON.stringify({ error: parsed.error.flatten() }), {
            status: 422,
            headers: { "Content-Type": "application/json" },
          });
        }

        const { to, subject, body: emailBody, leadId, allowRiskyEmail } = parsed.data;
        if (leadId) {
          const lead = await getLead(leadId);
          let verificationStatus = lead?.emailVerificationStatus ?? null;
          if (lead?.email?.trim() && lead.email.trim().toLowerCase() === to.trim().toLowerCase() && verificationStatus !== "verified") {
            const verification = await verifyEmail(to);
            if (verification) {
              verificationStatus = verification.status;
              await updateLead(lead.id, { emailVerificationStatus: verification.status, emailVerificationConfidence: verification.confidence, emailVerificationProvider: "hunter", emailVerifiedAt: new Date().toISOString() });
            }
          }
          if (verificationStatus === "not_found") {
            await recordProviderAuditEvent({ provider: "resend", eventType: "email.send", outcome: "failed", leadId, detail: { recipient: to, error: "email_not_verified" } });
            return new Response(JSON.stringify({ error: "email_not_verified", message: "This address was marked invalid during verification." }), { status: 409, headers: { "Content-Type": "application/json" } });
          }
          if (verificationStatus === "accept_all" && !allowRiskyEmail) {
            return new Response(JSON.stringify({ error: "accept_all_requires_confirmation", message: "This address is on a catch-all domain and cannot be fully verified. Confirm to send anyway." }), { status: 409, headers: { "Content-Type": "application/json" } });
          }
        }

        const result = await sendEmail({ to, subject, body: emailBody });
        await recordProviderAuditEvent({ provider: "resend", eventType: "email.send", outcome: result.success ? "succeeded" : "failed", leadId, providerMessageId: result.messageId, detail: { recipient: to, error: result.success ? null : result.error ?? "send_failed" } });

        if (result.success && leadId) {
          await updateLead(leadId, {
            status: "email_sent",
            emailSentAt: new Date().toISOString(),
          });
        }

        return Response.json(result);
      },
    },
  },
});
