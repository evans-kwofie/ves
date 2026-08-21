/**
 * Ingests leads discovered by the standalone Instagram discovery/enrichment
 * scraper (Python, run outside this app). Authenticated with a static bearer
 * token since the caller is a script, not a logged-in browser session.
 *
 * Setup: set INSTAGRAM_SCRAPER_TOKEN and pass it as `Authorization: Bearer <token>`.
 */
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { createLead } from "~/db/queries/leads";

const profileSchema = z.object({
  profileUrl: z.string().url(),
  username: z.string().min(1),
  displayName: z.string().nullable().optional(),
  bio: z.string().nullable().optional(),
  followers: z.number().int().nonnegative().nullable().optional(),
  linkInBio: z.string().nullable().optional(),
  sourcePostUrl: z.string().nullable().optional(),
  queryUsed: z.string().nullable().optional(),
});

const bodySchema = z.object({
  organizationId: z.string().min(1),
  profiles: z.array(profileSchema).min(1).max(500),
});

export const Route = createFileRoute("/api/discover/instagram/add")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const token = process.env.INSTAGRAM_SCRAPER_TOKEN;
        if (!token) {
          console.error("[discover/instagram/add] INSTAGRAM_SCRAPER_TOKEN not set");
          return new Response(JSON.stringify({ error: "misconfigured" }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
          });
        }

        const authHeader = request.headers.get("authorization") ?? "";
        if (authHeader !== `Bearer ${token}`) {
          return new Response(JSON.stringify({ error: "unauthorized" }), {
            status: 401,
            headers: { "Content-Type": "application/json" },
          });
        }

        let body: unknown;
        try {
          body = await request.json();
        } catch {
          return new Response(JSON.stringify({ error: "invalid_json" }), {
            status: 400,
            headers: { "Content-Type": "application/json" },
          });
        }

        const parsed = bodySchema.safeParse(body);
        if (!parsed.success) {
          return new Response(JSON.stringify({ error: parsed.error.flatten() }), {
            status: 422,
            headers: { "Content-Type": "application/json" },
          });
        }

        const { organizationId, profiles } = parsed.data;
        let saved = 0;
        let skipped = 0;

        for (const p of profiles) {
          try {
            await createLead(organizationId, {
              company: p.displayName ?? p.username,
              ceo: p.displayName ?? p.username,
              website: p.profileUrl,
              whatTheyDo: p.bio ?? "",
              fit: "MEDIUM",
              notes: [
                `Discovered via Instagram${p.queryUsed ? ` (query: ${p.queryUsed})` : ""}`,
                `@${p.username}`,
                p.followers != null ? `Followers: ${p.followers}` : null,
                p.linkInBio ? `Link in bio: ${p.linkInBio}` : null,
                p.sourcePostUrl ? `Found via post: ${p.sourcePostUrl}` : null,
                "No email found — needs manual outreach or enrichment.",
              ]
                .filter(Boolean)
                .join("\n"),
              source: "instagram",
              sourceDetails: { username: p.username, query: p.queryUsed ?? null, sourcePostUrl: p.sourcePostUrl ?? null, followers: p.followers ?? null },
            });
            saved++;
          } catch {
            skipped++;
          }
        }

        return Response.json({ saved, skipped });
      },
    },
  },
});
