import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { createLead } from "~/db/queries/leads";
import type { Lead } from "~/types/lead";

const leadSchema = z.object({
  company: z.string().min(1),
  ceo: z.string().default(""),
  email: z.string().email().nullable().optional(),
  website: z.string().default(""),
  linkedin: z.string().default(""),
  whatTheyDo: z.string().default(""),
  notes: z.string().default(""),
  role: z.string().default(""),
  industry: z.string().default(""),
  companySize: z.string().default(""),
  location: z.string().default(""),
  intentSignals: z.array(z.string()).default([]),
  engagementHistory: z.array(z.string()).default([]),
  sourceDetails: z.record(z.string(), z.string()).default({}),
});

const bodySchema = z.object({
  orgId: z.string().min(1),
  leads: z.array(leadSchema).min(1).max(500),
});

export const Route = createFileRoute("/api/pipeline/import")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        let body: unknown;
        try { body = await request.json(); } catch {
          return new Response(JSON.stringify({ error: "invalid_json" }), { status: 400, headers: { "Content-Type": "application/json" } });
        }

        const parsed = bodySchema.safeParse(body);
        if (!parsed.success) {
          return new Response(JSON.stringify({ error: parsed.error.flatten() }), { status: 422, headers: { "Content-Type": "application/json" } });
        }

        const { orgId, leads } = parsed.data;
        const imported: Lead[] = [];
        let skipped = 0;

        for (const lead of leads) {
          try {
            imported.push(await createLead(orgId, {
              company: lead.company,
              ceo: lead.ceo,
              email: lead.email ?? undefined,
              website: lead.website,
              linkedin: lead.linkedin,
              whatTheyDo: lead.whatTheyDo,
              notes: lead.notes,
              role: lead.role || undefined,
              industry: lead.industry || undefined,
              companySize: lead.companySize || undefined,
              location: lead.location || undefined,
              intentSignals: lead.intentSignals,
              engagementHistory: lead.engagementHistory.map((summary) => ({
                type: "imported",
                summary,
                recordedAt: new Date().toISOString(),
              })),
              fit: "MEDIUM",
              source: "import",
              sourceDetails: { importSource: "csv", originalRow: lead.sourceDetails },
            }));
          } catch {
            skipped++;
          }
        }

        return Response.json({ ok: true, imported: imported.length, skipped, leads: imported });
      },
    },
  },
});
