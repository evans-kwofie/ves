import { createFileRoute } from "@tanstack/react-router";
import { auth } from "~/lib/auth";
import { listKeywords } from "~/db/queries/keywords";
import Anthropic from "@anthropic-ai/sdk";
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
          return new Response(JSON.stringify({ error: "organizationId required" }), {
            status: 400,
            headers: { "Content-Type": "application/json" },
          });
        }

        const { organizationId } = parsed.data;

        // Get org metadata from Better Auth
        const orgs = await auth.api.listOrganizations({
          headers: request.headers,
        });
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

Respond ONLY with a JSON array. Each item must have:
- "keyword": the search term (lowercase, concise)
- "subreddits": array of subreddit names (no r/ prefix)
- "reason": one sentence why this keyword matters for them

JSON array only, no markdown.`;

        try {
          const client = new Anthropic();
          const response = await client.messages.create({
            model: "claude-sonnet-4-6",
            max_tokens: 1500,
            messages: [{ role: "user", content: prompt }],
          });

          const text =
            response.content[0]?.type === "text" ? response.content[0].text.trim() : "[]";
          const suggestions = suggestionSchema.safeParse(JSON.parse(text));

          if (!suggestions.success) {
            return new Response(JSON.stringify({ error: "Failed to parse suggestions" }), {
              status: 500,
              headers: { "Content-Type": "application/json" },
            });
          }

          return Response.json({ suggestions: suggestions.data });
        } catch {
          return new Response(JSON.stringify({ error: "AI generation failed" }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
          });
        }
      },
    },
  },
});
