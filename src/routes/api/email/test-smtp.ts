import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { sendEmail } from "~/agent/tools/email";
import { auth } from "~/lib/auth";
import { getRequestHeaders } from "@tanstack/react-start/server";

const schema = z.object({
  host: z.string().min(1),
  port: z.number().int().positive(),
  user: z.string().email(),
  pass: z.string().min(1),
  fromName: z.string(),
  secure: z.boolean(),
});

export const Route = createFileRoute("/api/email/test-smtp")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        let body: unknown;
        try { body = await request.json(); } catch {
          return new Response(JSON.stringify({ error: "invalid_json" }), { status: 400, headers: { "Content-Type": "application/json" } });
        }

        const parsed = schema.safeParse(body);
        if (!parsed.success) {
          return new Response(JSON.stringify({ error: parsed.error.flatten() }), { status: 422, headers: { "Content-Type": "application/json" } });
        }

        // Send a test email to the user's own address
        const result = await sendEmail(
          {
            to: parsed.data.user,
            subject: "Nextreach SMTP test — connection successful",
            body: `Your SMTP settings are working. Nextreach will use ${parsed.data.user} to send outreach emails on your behalf.`,
          },
          parsed.data,
        );

        if (result.ok ?? result.success) return Response.json({ ok: true });
        return new Response(JSON.stringify({ error: result.error ?? "Send failed" }), { status: 400, headers: { "Content-Type": "application/json" } });
      },
    },
  },
});
