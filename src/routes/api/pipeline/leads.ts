import { createFileRoute } from "@tanstack/react-router";
import { createLead, listLeads } from "~/db/queries/leads";
import { z } from "zod";

const createSchema = z.object({
  organizationId: z.string().min(1),
  company: z.string().min(1),
  website: z.string().optional(),
  whatTheyDo: z.string().optional(),
  ceo: z.string().min(1),
  email: z.string().email(),
  linkedin: z.string().optional(),
  fit: z.enum(["HIGH", "MEDIUM", "LOW"]),
  notes: z.string().optional(),
});

export const Route = createFileRoute("/api/pipeline/leads")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const orgId = url.searchParams.get("orgId");
        if (!orgId) return new Response(JSON.stringify({ error: "orgId required" }), { status: 400, headers: { "Content-Type": "application/json" } });
        const leads = await listLeads(orgId);
        return Response.json(leads);
      },
      POST: async ({ request }) => {
        let body: unknown;
        try {
          body = await request.json();
        } catch {
          return new Response(JSON.stringify({ error: "invalid_json" }), { status: 400, headers: { "Content-Type": "application/json" } });
        }

        const parsed = createSchema.safeParse(body);
        if (!parsed.success) {
          return new Response(JSON.stringify({ error: parsed.error.flatten() }), { status: 422, headers: { "Content-Type": "application/json" } });
        }

        const { organizationId, ...input } = parsed.data;
        try {
          const lead = await createLead(organizationId, input);
          return Response.json(lead, { status: 201 });
        } catch (err) {
          const message = err instanceof Error ? err.message : "unknown_error";
          return new Response(JSON.stringify({ error: message }), { status: 409, headers: { "Content-Type": "application/json" } });
        }
      },
    },
  },
});
