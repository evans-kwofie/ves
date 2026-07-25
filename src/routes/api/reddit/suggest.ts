import { createFileRoute } from "@tanstack/react-router";
import { saveReplySuggestion } from "~/db/queries/reddit";
import { geminiComplete } from "~/agent/tools/gemini";
import { z } from "zod";

const requestSchema = z.object({
  postId: z.string(),
  title: z.string(),
  body: z.string(),
  subreddit: z.string(),
  engagementType: z.enum(["helpful", "pitch", "authority", "question"]).nullable().optional(),
});

const ENGAGEMENT_INSTRUCTION: Record<string, string> = {
  helpful: "Be genuinely helpful — share expertise, solve their problem, add real value with no agenda.",
  pitch: "You can be slightly more direct about how a relevant solution could help, but lead with value first.",
  authority: "Establish expertise. Share a data point, case study, or insight that builds credibility.",
  question: "Ask a thoughtful follow-up question that shows you deeply understand their problem.",
};

export const Route = createFileRoute("/api/reddit/suggest")({
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

        const { postId, title, body: postBody, subreddit, engagementType } = parsed.data;

        const angleInstruction = engagementType && ENGAGEMENT_INSTRUCTION[engagementType]
          ? `\nAngle: ${ENGAGEMENT_INSTRUCTION[engagementType]}`
          : "";

        const prompt = `You are a helpful, genuine community member on r/${subreddit}. Write a short, valuable reply to this Reddit post. Be conversational and avoid being salesy. Keep it under 150 words.${angleInstruction}

Post title: ${title}
Post body: ${postBody || "(no body)"}

Write only the reply text, nothing else.`;

        const suggestion = await geminiComplete(prompt, { maxTokens: 300 });

        await saveReplySuggestion(postId, suggestion.trim());

        return Response.json({ suggestion: suggestion.trim() });
      },
    },
  },
});
