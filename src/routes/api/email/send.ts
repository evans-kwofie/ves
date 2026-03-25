import { createFileRoute } from "@tanstack/react-router";
import { sendEmail } from "~/agent/tools/email";
import { updateLead } from "~/db/queries/leads";
import { initDb } from "~/db/schema";
import { z } from "zod";

const requestSchema = z.object({
  to: z.string().email(),
  subject: z.string().min(1),
  body: z.string().min(1),
  leadId: z.string().optional(),
});

export const Route = createFileRoute("/api/email/send")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        await initDb();
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

        const { to, subject, body: emailBody, leadId } = parsed.data;

        const result = await sendEmail({ to, subject, body: emailBody });

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
