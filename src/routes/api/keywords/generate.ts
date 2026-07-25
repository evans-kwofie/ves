import { createFileRoute } from "@tanstack/react-router";
import { auth } from "~/lib/auth";
import { listKeywords } from "~/db/queries/keywords";
import { geminiJSON } from "~/agent/tools/gemini";
import { z } from "zod";

const requestSchema = z.object({
  organizationId: z.string().min(1),
});

const suggestionSchema = z.array(
  z.object({
    keyword: z.string(),
    subreddits: z.array(z.string()),
    reason: z.string(),
  }),
);

export const Route = createFileRoute("/api/keywords/generate")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        let body: unknown = {};
        try {
          body = await request.json();
        } catch {}

        const parsed = requestSchema.safeParse(body);
        if (!parsed.success) {
          console.error("[keywords/generate] invalid body:", body);
          return new Response(JSON.stringify({ error: "organizationId required" }), {
            status: 400,
            headers: { "Content-Type": "application/json" },
          });
        }

        const { organizationId } = parsed.data;

        const orgs = await auth.api.listOrganizations({ headers: request.headers });
        const org = orgs?.find((o: { id: string }) => o.id === organizationId) ?? orgs?.[0];
        if (!org) {
          return new Response(JSON.stringify({ error: "Organization not found" }), {
            status: 404,
            headers: { "Content-Type": "application/json" },
          });
        }

        let metadata: Record<string, string> = {};
        try {
          metadata = org.metadata ? JSON.parse(org.metadata as string) : {};
        } catch {}

        const existingKeywords = await listKeywords(organizationId);
        const existingList = existingKeywords.map((k) => k.keyword).join(", ");

        const context = [
          `Company: ${org.name}`,
          metadata.description ? `Description: ${metadata.description}` : null,
          metadata.website ? `Website: ${metadata.website}` : null,
          metadata.industry ? `Industry: ${metadata.industry}` : null,
          metadata.companySize ? `Team size: ${metadata.companySize}` : null,
        ]
          .filter(Boolean)
          .join("\n");

        const prompt = `You are helping a B2B sales team find the right keywords to monitor on Reddit and use for outreach.

Here is the company context:
${context}

${existingList ? `They already track these keywords (do not suggest these): ${existingList}` : ""}

Generate 10 specific, high-intent keyword suggestions this company should track. Focus on:
- Pain points their ideal customers express online
- Problems their product solves
- Comparison terms (e.g. "X vs Y", "alternative to X")
- Job-to-be-done phrases ("how to...", "best way to...")
- Category terms buyers use when evaluating solutions

For each keyword also suggest 2-3 relevant subreddits where that keyword would surface buying intent.

Respond ONLY with a JSON object in this exact shape:
{"suggestions": [{"keyword": "...", "subreddits": ["..."], "reason": "..."}, ...]}

No markdown, no extra keys.`;

        try {
          const raw = await geminiJSON<{ suggestions: unknown[] }>(prompt, {
            maxTokens: 1500,
          });

          if (!raw?.suggestions) {
            return new Response(JSON.stringify({ error: "AI generation failed" }), {
              status: 500,
              headers: { "Content-Type": "application/json" },
            });
          }

          const suggestions = suggestionSchema.safeParse(raw.suggestions);
          if (!suggestions.success) {
            console.error("[keywords/generate] schema validation failed:", suggestions.error.flatten());
            return new Response(JSON.stringify({ error: "Failed to parse suggestions" }), {
              status: 500,
              headers: { "Content-Type": "application/json" },
            });
          }

          // Validate all subreddits against Reddit API in parallel, drop fakes
          const userAgent = process.env.REDDIT_USER_AGENT ?? "vesper/1.0";
          // Normalise: strip any leading "r/" Mistral may have included
          const normaliseSub = (s: string) => s.replace(/^r\//, "");
          const allSubs = [...new Set(suggestions.data.flatMap((s) => s.subreddits).map(normaliseSub))];

          const validSet = new Set(
            (
              await Promise.all(
                allSubs.map(async (sub) => {
                  const url = `https://www.reddit.com/r/${sub}/about.json`;
                  try {
                    const res = await fetch(url, { headers: { "User-Agent": userAgent } });
                    return res.status !== 404 ? sub : null;
                  } catch {
                    return null;
                  }
                }),
              )
            ).filter((s): s is string => s !== null),
          );

          suggestions.data.forEach((s) => {
            s.subreddits = s.subreddits.map(normaliseSub);
          });

          const validated = suggestions.data
            .map((s) => ({ ...s, subreddits: s.subreddits.filter((r) => validSet.has(r)) }))
            .filter((s) => s.subreddits.length > 0);

          return Response.json({ suggestions: validated });
        } catch (err) {
          console.error("[keywords/generate] Gemini API error:", err);
          return new Response(JSON.stringify({ error: "AI generation failed", detail: String(err) }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
          });
        }
      },
    },
  },
});
