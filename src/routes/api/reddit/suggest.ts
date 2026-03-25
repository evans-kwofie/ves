import { createFileRoute } from "@tanstack/react-router";
import { initDb } from "~/db/schema";
import { saveReplySuggestion } from "~/db/queries/reddit";
import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";

const requestSchema = z.object({
  postId: z.string(),
  title: z.string(),
  body: z.string(),
  subreddit: z.string(),
});

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY, maxRetries: 2 });

export const Route = createFileRoute("/api/reddit/suggest")({
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

        const { postId, title, body: postBody, subreddit } = parsed.data;

        const prompt = `You are a helpful, genuine community member on r/${subreddit}. Write a short, valuable reply to this Reddit post. Be conversational, add real insight, and avoid being salesy. Keep it under 150 words.

Post title: ${title}
Post body: ${postBody || "(no body)"}

Write only the reply text, nothing else.`;

        const response = await client.messages.create({
          model: "claude-haiku-4-5-20251001",
          max_tokens: 300,
          messages: [{ role: "user", content: prompt }],
        });

        const suggestion =
          response.content[0]?.type === "text" ? response.content[0].text.trim() : "";

        await saveReplySuggestion(postId, suggestion);

        return Response.json({ suggestion });
      },
    },
  },
});
