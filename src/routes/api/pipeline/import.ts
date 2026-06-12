import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { v4 as uuidv4 } from "uuid";
import { db } from "~/db/client";
import type { Lead } from "~/types/lead";

const leadSchema = z.object({
  company: z.string().min(1),
  ceo: z.string().min(1),
  email: z.string().email().nullable().optional(),
  website: z.string().default(""),
  whatTheyDo: z.string().default(""),
  notes: z.string().default(""),
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
        const now = new Date().toISOString();
        const imported: Lead[] = [];
        let skipped = 0;

        for (const lead of leads) {
          try {
            const id = uuidv4();

            // Skip duplicate email if already exists
            if (lead.email) {
              const existing = await db.execute({
                sql: "SELECT id FROM leads WHERE email = ? AND organization_id = ?",
                args: [lead.email, orgId],
              });
              if (existing.rows.length > 0) { skipped++; continue; }
            }

            await db.execute({
              sql: `INSERT INTO leads
                      (id, organization_id, company, ceo, email, website, what_they_do, notes,
                       status, pipeline_stage, added_at, discovered_at, updated_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'not_contacted', 'discovered', ?, ?, ?)`,
              args: [id, orgId, lead.company, lead.ceo, lead.email ?? null, lead.website, lead.whatTheyDo, lead.notes, now, now, now],
            });

            imported.push({
              id,
              company: lead.company,
              ceo: lead.ceo,
              email: lead.email ?? "",
              website: lead.website,
              whatTheyDo: lead.whatTheyDo,
              linkedin: "",
              notes: lead.notes,
              status: "not_contacted",
              pipelineStage: "discovered",
              fit: "MEDIUM",
              fitReason: null,
              score: null,
              source: null,
              enrichmentAttempts: 0,
              addedAt: now,
              emailSentAt: null,
              linkedinSentAt: null,
              repliedAt: null,
            } as Lead);
          } catch {
            skipped++;
          }
        }

        return Response.json({ ok: true, imported: imported.length, skipped, leads: imported });
      },
    },
  },
});
