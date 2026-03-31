import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { v4 as uuidv4 } from "uuid";
import { createLead } from "~/db/queries/leads";
import type { DirectoryResult } from "./search";

const resultSchema = z.object({
  company: z.string(),
  founderName: z.string().nullable(),
  whatTheyDo: z.string(),
  website: z.string(),
  email: z.string().nullable(),
  linkedinHint: z.string().nullable(),
  directoryUrl: z.string(),
  launchedAt: z.string().nullable(),
});

const requestSchema = z.object({
  organizationId: z.string().min(1),
  directory: z.string().min(1),
  query: z.string(),
  results: z.array(resultSchema).min(1),
});

export const Route = createFileRoute("/api/directories/add")({
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

        const { organizationId, directory, results } = parsed.data;
        let saved = 0;
        let skipped = 0;

        for (const r of results as DirectoryResult[]) {
          // Use real email if found, otherwise a placeholder so the lead can still enter the pipeline
          const email = r.email ?? `directory-${uuidv4()}@placeholder.vesper`;

          const domain = r.website
            ? r.website.replace(/^https?:\/\//, "").split("/")[0].replace(/^www\./, "")
            : "";
          const website = domain ? `https://${domain}` : r.website;

          try {
            await createLead(organizationId, {
              company: r.company,
              ceo: r.founderName ?? "Unknown",
              website,
              whatTheyDo: r.whatTheyDo,
              email,
              linkedin: r.linkedinHint ?? "",
              fit: "MEDIUM",
              notes: [
                `Discovered via ${directory}`,
                r.directoryUrl ? `Listing: ${r.directoryUrl}` : null,
                r.launchedAt ? `Launched: ${r.launchedAt}` : null,
                !r.email ? "No email found — needs manual outreach or enrichment." : null,
              ]
                .filter(Boolean)
                .join("\n"),
              source: "directory",
            });
            saved++;
          } catch {
            // Duplicate email — already in pipeline
            skipped++;
          }
        }

        return Response.json({ saved, skipped });
      },
    },
  },
});
