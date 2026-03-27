import { createFileRoute } from "@tanstack/react-router";
import { auth } from "~/lib/auth";
import Anthropic from "@anthropic-ai/sdk";
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

        const context = [
          `Company name: ${name || org.name}`,
          (website || metadata.website) ? `Website: ${website || metadata.website}` : null,
          (industry || metadata.industry) ? `Industry: ${industry || metadata.industry}` : null,
        ]
          .filter(Boolean)
          .join("\n");

        const prompt = `You are helping a B2B company write a concise business description for their sales tool profile.

Context:
${context}

Write a 2-3 sentence business description that covers:
1. What the company does (product/service)
2. Who their ideal customer is
3. The core problem they solve or value they deliver

Be specific and direct. No fluff, no buzzwords. Write in third person. Keep it under 80 words.

Return only the description text, no quotes, no labels.`;

        try {
          const client = new Anthropic();
          const response = await client.messages.create({
            model: "claude-haiku-4-5-20251001",
            max_tokens: 200,
            messages: [{ role: "user", content: prompt }],
          });

          const description =
            response.content[0]?.type === "text" ? response.content[0].text.trim() : "";

          return Response.json({ description });
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
