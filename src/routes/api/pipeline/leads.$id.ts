import { createFileRoute } from "@tanstack/react-router";
import { initDb } from "~/db/schema";
import { updateLead } from "~/db/queries/leads";
import { z } from "zod";

const updateSchema = z.object({
  status: z
    .enum([
      "not_contacted",
      "email_sent",
      "linkedin_sent",
      "replied",
      "call_scheduled",
      "converted",
      "not_interested",
    ])
    .optional(),
  notes: z.string().optional(),
  emailSentAt: z.string().nullable().optional(),
  linkedinSentAt: z.string().nullable().optional(),
  repliedAt: z.string().nullable().optional(),
});

export const Route = createFileRoute("/api/pipeline/leads/$id")({
  server: {
    handlers: {
      PUT: async ({ request, params }) => {
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

        const parsed = updateSchema.safeParse(body);
        if (!parsed.success) {
          return new Response(JSON.stringify({ error: parsed.error.flatten() }), {
            status: 422,
            headers: { "Content-Type": "application/json" },
          });
        }

        try {
          const lead = await updateLead(params.id, parsed.data);
          return Response.json(lead);
        } catch (err) {
          const message = err instanceof Error ? err.message : "unknown_error";
          return new Response(JSON.stringify({ error: message }), {
            status: 404,
            headers: { "Content-Type": "application/json" },
          });
        }
      },
    },
  },
});
