import { createFileRoute } from "@tanstack/react-router";
import { getLead, updateLead, createOutreachEvent, getOutreachEvents } from "~/db/queries/leads";
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
          const existing = await getLead(params.id);
          const lead = await updateLead(params.id, parsed.data);

          // Write outreach event when status transitions to a trackable value
          const newStatus = parsed.data.status;
          const prevStatus = existing?.status;
          if (newStatus && newStatus !== prevStatus) {
            const now = new Date().toISOString();
            if (newStatus === "email_sent") {
              await createOutreachEvent({ leadId: params.id, channel: "email", status: "sent", sentAt: now });
            } else if (newStatus === "linkedin_sent") {
              await createOutreachEvent({ leadId: params.id, channel: "linkedin", status: "sent", sentAt: now });
            } else if (newStatus === "replied") {
              await createOutreachEvent({ leadId: params.id, channel: "reply", status: "replied", repliedAt: now });
            } else if (newStatus === "converted") {
              await createOutreachEvent({ leadId: params.id, channel: "deal", status: "converted", sentAt: now });
            }
          }

          return Response.json(lead);
        } catch (err) {
          const message = err instanceof Error ? err.message : "unknown_error";
          return new Response(JSON.stringify({ error: message }), {
            status: 404,
            headers: { "Content-Type": "application/json" },
          });
        }
      },
      GET: async ({ params }) => {
        try {
          const events = await getOutreachEvents(params.id);
          return Response.json(events);
        } catch (err) {
          const message = err instanceof Error ? err.message : "unknown_error";
          return new Response(JSON.stringify({ error: message }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
          });
        }
      },
    },
  },
});
