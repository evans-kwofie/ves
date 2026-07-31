import { createFileRoute } from "@tanstack/react-router";
import { createLinkedInPost } from "~/db/queries/linkedin";
import { geminiComplete } from "~/agent/tools/gemini";
import { db } from "~/db/client";
import { z } from "zod";
import type { LinkedInWritingStyle } from "~/routes/$workspaceId/settings/writing-style";

const requestSchema = z.object({
  organizationId: z.string().min(1),
  keyword: z.string().min(1).max(200),
  angle: z.string().max(500).optional(),
  keywordId: z.string().optional(),
  content: z.string().optional(), // pre-generated content to save directly
});

async function getWritingStyle(organizationId: string): Promise<LinkedInWritingStyle | null> {
  try {
    const result = await db.execute({
      sql: "SELECT metadata FROM organization WHERE id = ? OR slug = ?",
      args: [organizationId, organizationId],
    });
    const row = result.rows[0];
    let meta: Record<string, string> = {};
    try { meta = row?.metadata ? JSON.parse(row.metadata as string) : {}; } catch {}
    let style: Partial<LinkedInWritingStyle> = {};
    try { style = meta.linkedinWritingStyle ? JSON.parse(meta.linkedinWritingStyle) : {}; } catch {}
    if (!style.examplePosts && !style.sentenceStyle && !style.hookStyle && !style.avoidPhrases) return null;
    return {
      examplePosts:  style.examplePosts  ?? "",
      sentenceStyle: style.sentenceStyle ?? "",
      hookStyle:     style.hookStyle     ?? "",
      avoidPhrases:  style.avoidPhrases  ?? "",
    };
  } catch {
    return null;
  }
}

function buildPrompt(keyword: string, angle: string | undefined, style: LinkedInWritingStyle | null): string {
  const parts: string[] = [];

  if (style?.examplePosts?.trim()) {
    parts.push(`Here are examples of how this person actually writes on LinkedIn — mirror their voice, sentence structure, vocabulary, and rhythm closely:

${style.examplePosts.trim()}

---
`);
  }

  parts.push(`Write a LinkedIn post about "${keyword}"${angle ? `. Angle/focus: ${angle}` : ""}.`);

  const requirements = [
    "150-250 words",
    "First person, insight-driven, not promotional",
    "No hashtags in body (add 2-3 at the end only)",
    "No em-dashes",
    "Write only the post text, ready to copy-paste",
  ];

  if (style?.sentenceStyle === "short") {
    requirements.push("Use short, punchy sentences — one idea per sentence, plenty of white space");
  } else if (style?.sentenceStyle === "long") {
    requirements.push("Use longer, flowing sentences that develop ideas fully");
  }

  if (style?.hookStyle === "question") {
    requirements.push("Open with a compelling question");
  } else if (style?.hookStyle === "statement") {
    requirements.push("Open with a bold statement or opinion (not 'I' as the first word)");
  } else if (style?.hookStyle === "story") {
    requirements.push("Open mid-scene or with a personal moment");
  } else if (style?.hookStyle === "stat") {
    requirements.push("Open with a surprising stat or number");
  } else {
    requirements.push("Start with a hook (no 'I' as first word)");
  }

  if (style?.avoidPhrases?.trim()) {
    requirements.push(`Never use these words or phrases: ${style.avoidPhrases.trim()}`);
  }

  parts.push(`\nRequirements:\n${requirements.map((r) => `- ${r}`).join("\n")}`);

  if (style?.examplePosts?.trim()) {
    parts.push("\nThe post must sound like it was written by the same person who wrote the examples above — not generic AI output.");
  }

  return parts.join("\n");
}

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

        const { organizationId, keyword, angle, keywordId, content: pregenerated } = parsed.data;

        // If pre-generated content is provided, save it directly without re-generating
        if (pregenerated) {
          const post = await createLinkedInPost(organizationId, pregenerated, keywordId ?? null);
          return Response.json({ content: pregenerated, post });
        }

        const style = await getWritingStyle(organizationId);
        const prompt = buildPrompt(keyword, angle, style);

        const generatedContent = (await geminiComplete(prompt, { maxTokens: 2048, thinkingBudget: 0 })).trim();

        return Response.json({ content: generatedContent });
      },
    },
  },
});
