import { createFileRoute } from "@tanstack/react-router";
import { createBlogPost } from "~/db/queries/blog";
import { geminiComplete } from "~/agent/tools/gemini";
import { z } from "zod";

const requestSchema = z.object({
  organizationId: z.string().min(1),
  keywords: z.array(z.string()).min(1),
  angle: z.string().max(500).optional(),
  save: z.boolean().optional(),
});

export const Route = createFileRoute("/api/blog/generate")({
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

        const { organizationId, keywords, angle, save: shouldSave } = parsed.data;

        const prompt = `Write a high-quality blog post targeting these keywords: ${keywords.join(", ")}.
${angle ? `Focus/angle: ${angle}` : ""}

Requirements:
- 600-900 words
- Markdown format
- Start with an H1 title
- Include 2-3 H2 subheadings
- Practical, insight-driven content
- First person, founder voice
- No fluff, no generic advice
- No em-dashes
- End with a clear takeaway or CTA

Write the full blog post in Markdown. Nothing else.`;

        const content = (await geminiComplete(prompt, { maxTokens: 8192, thinkingBudget: 0 })).trim();

        // Extract title from first H1
        const titleMatch = content.match(/^#\s+(.+)$/m);
        const title = titleMatch ? titleMatch[1].trim() : keywords[0];

        if (shouldSave && content) {
          const post = await createBlogPost(organizationId, { title, content, keywords });
          return Response.json({ content, post });
        }

        return Response.json({ content, title });
      },
    },
  },
});
