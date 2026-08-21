import { createFileRoute } from "@tanstack/react-router";
import { getLead, updateLead, deleteLead, createOutreachEvent, getOutreachEvents, getEnrichmentAttempts } from "~/db/queries/leads";
import { skipScheduledDraftsForLead } from "~/db/queries/drafts";
import { z } from "zod";

const updateSchema = z.object({
  company: z.string().min(1).optional(),
  ceo: z.string().optional(),
  email: z.string().email().nullable().optional(),
  website: z.string().optional(),
  whatTheyDo: z.string().optional(),
  linkedin: z.string().optional(),
  fit: z.enum(["HIGH", "MEDIUM", "LOW"]).optional(),
  fitReason: z.string().nullable().optional(),
  score: z.number().int().min(0).max(100).nullable().optional(),
  status: z
    .enum([
      "not_contacted",
      "email_sent",
      "linkedin_sent",
      "instagram_sent",
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
          console.error("[lead-update-validation] Invalid JSON body", { leadId: params.id });
          return new Response(JSON.stringify({ error: "invalid_json" }), {
            status: 400,
            headers: { "Content-Type": "application/json" },
          });
        }

        const parsed = updateSchema.safeParse(body);
        if (!parsed.success) {
          const issues = parsed.error.issues.map((issue) => ({
            field: issue.path.join(".") || "request",
            code: issue.code,
            message: issue.message,
          }));
          console.error("[lead-update-validation] Rejected lead update", {
            leadId: params.id,
            issues,
          });
          return new Response(JSON.stringify({ error: "validation_failed", issues }), {
            status: 422,
            headers: { "Content-Type": "application/json" },
          });
        }

        try {
          const existing = await getLead(params.id);
          let lead = await updateLead(params.id, parsed.data);

          // Write outreach event when status transitions to a trackable value
          const newStatus = parsed.data.status;
          const prevStatus = existing?.status;
          if (newStatus && newStatus !== prevStatus) {
            const now = new Date().toISOString();
            if (newStatus === "email_sent") {
              await createOutreachEvent({ leadId: params.id, channel: "email", status: "sent", sentAt: now });
            } else if (newStatus === "linkedin_sent") {
              await createOutreachEvent({ leadId: params.id, channel: "linkedin", status: "sent", sentAt: now });
            } else if (newStatus === "instagram_sent") {
              await createOutreachEvent({ leadId: params.id, channel: "instagram", status: "sent", sentAt: now });
            } else if (newStatus === "replied" || newStatus === "call_scheduled" || newStatus === "converted") {
              const [repliedLead] = await Promise.all([
                updateLead(params.id, { ...(newStatus === "replied" ? { repliedAt: now } : {}) }),
                skipScheduledDraftsForLead(params.id),
                createOutreachEvent({ leadId: params.id, channel: newStatus === "replied" ? "reply" : "deal", status: newStatus === "call_scheduled" ? "meeting" : newStatus, repliedAt: newStatus === "replied" ? now : undefined, sentAt: newStatus === "replied" ? undefined : now }),
              ]);
              lead = repliedLead;
            } else if (newStatus === "not_interested") {
              lead = await updateLead(params.id, { optedOutAt: now });
              await skipScheduledDraftsForLead(params.id);
            }
          }

          return Response.json(lead);
        } catch (err) {
          const message = err instanceof Error ? err.message : "unknown_error";
          console.error("[lead-update] Failed to update lead", { leadId: params.id, message });
          return new Response(JSON.stringify({ error: message }), {
            status: 404,
            headers: { "Content-Type": "application/json" },
          });
        }
      },
      DELETE: async ({ params }) => {
        try {
          await deleteLead(params.id);
          return new Response(null, { status: 204 });
        } catch (err) {
          const message = err instanceof Error ? err.message : "unknown_error";
          return new Response(JSON.stringify({ error: message }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
          });
        }
      },
      GET: async ({ params, request }) => {
        try {
          const lead = await getLead(params.id);
          if (!lead) {
            return new Response(JSON.stringify({ error: "not_found" }), {
              status: 404,
              headers: { "Content-Type": "application/json" },
            });
          }
          const includeEvents = new URL(request.url).searchParams.get("include") === "events";
          if (!includeEvents) return Response.json(lead);
          const [events, enrichmentAttempts] = await Promise.all([getOutreachEvents(params.id), getEnrichmentAttempts(params.id)]);
          return Response.json({ lead, events, enrichmentAttempts });
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
