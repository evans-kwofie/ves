import { createFileRoute } from "@tanstack/react-router";
import { auth } from "~/lib/auth";
import { listLeads, queueLeadEnrichment } from "~/db/queries/leads";
import { z } from "zod";

const requestSchema = z.object({ organizationId: z.string().min(1), leadId: z.string().optional() });

export const Route = createFileRoute("/api/pipeline/enrich")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        let body: unknown;
        try { body = await request.json(); } catch {
          return new Response(JSON.stringify({ error: "invalid_json" }), { status: 400, headers: { "Content-Type": "application/json" } });
        }
        const parsed = requestSchema.safeParse(body);
        if (!parsed.success) return new Response(JSON.stringify({ error: "organizationId required" }), { status: 400, headers: { "Content-Type": "application/json" } });

        const { organizationId, leadId } = parsed.data;
        const organizations = await auth.api.listOrganizations({ headers: request.headers });
        if (!organizations?.some((organization: { id: string }) => organization.id === organizationId)) {
          return new Response(JSON.stringify({ error: "organization_not_found" }), { status: 404, headers: { "Content-Type": "application/json" } });
        }
        const leads = await listLeads(organizationId);
        const toEnrich = leadId ? leads.filter((lead) => lead.id === leadId) : leads.filter((lead) => lead.pipelineStage === "discovered" && lead.enrichmentAttempts < 3);
        const jobs = await Promise.all(toEnrich.map(queueLeadEnrichment));
        return Response.json({ ok: true, queued: jobs.length, total: toEnrich.length });
      },
    },
  },
});
