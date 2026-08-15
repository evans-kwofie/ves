import { createFileRoute } from "@tanstack/react-router";
import { v4 as uuidv4 } from "uuid";
import { z } from "zod";
import { db } from "~/db/client";
import { createLead } from "~/db/queries/leads";

const requestSchema = z.object({
  organizationId: z.string(),
  postId: z.string(),
  author: z.string(),
  title: z.string(),
  subreddit: z.string(),
  url: z.string(),
  intentType: z.string().nullable().optional(),
});

export const Route = createFileRoute("/api/reddit/to-pipeline")({
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

        const { organizationId, author, title, subreddit, url, intentType } = parsed.data;

        // Check if this Reddit author is already in the pipeline for this org
        const existing = await db.execute({
          sql: "SELECT id FROM leads WHERE organization_id = ? AND source = 'reddit' AND website = ?",
          args: [organizationId, `https://reddit.com/user/${author}`],
        });
        if (existing.rows.length > 0) {
          const existingId = (existing.rows[0] as Record<string, unknown>).id as string;
          return Response.json({ error: "duplicate", leadId: existingId }, { status: 409 });
        }

        const placeholderEmail = `reddit-${uuidv4()}@placeholder.nextreach`;

        try {
          const lead = await createLead(organizationId, {
            company: `u/${author}`,
            ceo: author,
            website: `https://reddit.com/user/${author}`,
            whatTheyDo: `Reddit user in r/${subreddit}. Post: "${title}"`,
            email: placeholderEmail,
            linkedin: "",
            fit: "MEDIUM",
            notes: `Discovered via Reddit${intentType ? ` (${intentType} signal)` : ""}: ${url}\nNo email found — needs manual outreach`,
            source: "reddit",
          });
          return Response.json({ lead });
        } catch (err) {
          const msg = err instanceof Error ? err.message : "unknown";
          return Response.json({ error: msg }, { status: 500 });
        }
      },
    },
  },
});
