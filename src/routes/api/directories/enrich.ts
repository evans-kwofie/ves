import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { enrichResults } from "~/agent/tools/enrich";

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
  results: z.array(resultSchema).min(1).max(20),
});

export const Route = createFileRoute("/api/directories/enrich")({
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
          return new Response(
            JSON.stringify({ error: parsed.error.flatten() }),
            { status: 422, headers: { "Content-Type": "application/json" } },
          );
        }

        const enriched = await enrichResults(parsed.data.results);
        return Response.json({ results: enriched });
      },
    },
  },
});
