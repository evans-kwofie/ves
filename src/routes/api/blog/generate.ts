import { createFileRoute } from "@tanstack/react-router";
import { initDb } from "~/db/schema";
import { createBlogPost } from "~/db/queries/blog";
import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";

const requestSchema = z.object({
  keywords: z.array(z.string()).min(1),
  angle: z.string().max(500).optional(),
  save: z.boolean().optional(),
});

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY, maxRetries: 2 });

export const Route = createFileRoute("/api/blog/generate")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        await initDb();
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

        const { keywords, angle, save: shouldSave } = parsed.data;

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

        const response = await client.messages.create({
          model: "claude-sonnet-4-6",
          max_tokens: 2000,
          messages: [{ role: "user", content: prompt }],
        });

        const content =
          response.content[0]?.type === "text" ? response.content[0].text.trim() : "";

        // Extract title from first H1
        const titleMatch = content.match(/^#\s+(.+)$/m);
        const title = titleMatch ? titleMatch[1].trim() : keywords[0];

        if (shouldSave && content) {
          const post = await createBlogPost({ title, content, keywords });
          return Response.json({ content, post });
        }

        return Response.json({ content, title });
      },
    },
  },
});
