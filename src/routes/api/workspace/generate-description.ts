import { createFileRoute } from "@tanstack/react-router";
import { auth } from "~/lib/auth";
import { mistralComplete } from "~/agent/tools/mistral";
import { z } from "zod";

const requestSchema = z.object({
  organizationId: z.string().min(1),
  website: z.string().optional(),
  name: z.string().optional(),
  industry: z.string().optional(),
});

export const Route = createFileRoute("/api/workspace/generate-description")({
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

        const { organizationId, website, name, industry } = parsed.data;

        const orgs = await auth.api.listOrganizations({ headers: request.headers });
        const org = orgs?.find((o: { id: string }) => o.id === organizationId);
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

        const context = [
          `Company name: ${name || org.name}`,
          (website || metadata.website) ? `Website: ${website || metadata.website}` : null,
          (industry || metadata.industry) ? `Industry: ${industry || metadata.industry}` : null,
        ]
          .filter(Boolean)
          .join("\n");

        const companyName = name || org.name;
        const prompt = `Write a 2-3 sentence business description for the company called "${companyName}".

${context}

The description must be about ${companyName} itself — what they do, who their customers are, and the core value they deliver. Do not describe any outreach tool, sales platform, or software they might use.

Guidelines:
- Third person ("${companyName} helps…" or "${companyName} is…")
- Specific and direct — no buzzwords or filler
- Under 80 words

Return only the description text. No quotes, no labels.`;

        try {
          const description = await mistralComplete(prompt, {
            model: "mistral-small-latest",
            maxTokens: 200,
          });
          return Response.json({ description: description.trim() });
        } catch {
          return new Response(JSON.stringify({ error: "Generation failed" }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
          });
        }
      },
    },
  },
});
