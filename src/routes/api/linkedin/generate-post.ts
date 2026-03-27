import { createFileRoute } from "@tanstack/react-router";
import { createLinkedInPost } from "~/db/queries/linkedin";
import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";

const requestSchema = z.object({
  organizationId: z.string().min(1),
  keyword: z.string().min(1).max(200),
  angle: z.string().max(500).optional(),
  keywordId: z.string().optional(),
  save: z.boolean().optional(),
});

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY, maxRetries: 2 });

export const Route = createFileRoute("/api/linkedin/generate-post")({
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

        const { organizationId, keyword, angle, keywordId, save: shouldSave } = parsed.data;

        const prompt = `Write a LinkedIn post about "${keyword}"${angle ? `. Angle/focus: ${angle}` : ""}.

Requirements:
- 150-250 words
- Start with a hook (no "I" as first word)
- First person, conversational, founder voice
- Insight-driven, not promotional
- End with a soft question or call to reflection
- No hashtags in body (add 2-3 at the end only)
- No em-dashes

Write only the post text, ready to copy-paste.`;

        const response = await client.messages.create({
          model: "claude-sonnet-4-6",
          max_tokens: 600,
          messages: [{ role: "user", content: prompt }],
        });

        const content =
          response.content[0]?.type === "text" ? response.content[0].text.trim() : "";

        if (shouldSave && content) {
          const post = await createLinkedInPost(organizationId, content, keywordId ?? null);
          return Response.json({ content, post });
        }

        return Response.json({ content });
      },
    },
  },
});
