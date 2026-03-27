import { createFileRoute } from "@tanstack/react-router";
import { listActiveKeywordsWithSubreddits } from "~/db/queries/keywords";
import { upsertRedditPost, saveClassification } from "~/db/queries/reddit";
import { createLead } from "~/db/queries/leads";
import type { RedditApiResponse, IntentType, EngagementType } from "~/types/reddit";
import { z } from "zod";
import Anthropic from "@anthropic-ai/sdk";

const requestSchema = z.object({
  organizationId: z.string().min(1),
  keywordId: z.string().optional(),
});

const classificationSchema = z.object({
  intent_type: z.enum(["buying", "pain", "discussion", "noise"]),
  intent_score: z.number().int().min(0).max(100),
  engagement_type: z.enum(["helpful", "pitch", "authority", "question"]),
  engagement_score: z.number().int().min(0).max(100),
});

async function classifyPost(
  title: string,
  body: string,
  subreddit: string,
): Promise<z.infer<typeof classificationSchema> | null> {
  const client = new Anthropic();
  const prompt = `Classify this Reddit post for a B2B sales tool.

Subreddit: r/${subreddit}
Title: ${title}
Body: ${body.slice(0, 500) || "(no body)"}

Return ONLY valid JSON with these fields:
- intent_type: one of "buying" (actively looking to buy/hire), "pain" (expressing a problem our product solves), "discussion" (general topic discussion), "noise" (irrelevant)
- intent_score: 0-100 (how likely this person is a potential buyer right now)
- engagement_type: one of "helpful" (share expertise), "pitch" (soft product mention), "authority" (thought leadership), "question" (ask a clarifying question)
- engagement_score: 0-100 (how valuable engaging with this post would be)

JSON only, no markdown.`;

  try {
    const response = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 150,
      messages: [{ role: "user", content: prompt }],
    });
    const text = response.content[0]?.type === "text" ? response.content[0].text.trim() : "";
    const parsed = classificationSchema.safeParse(JSON.parse(text));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

export const Route = createFileRoute("/api/reddit/search")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        let body: unknown = {};
        try {
          body = await request.json();
        } catch {
          // allow empty body
        }

        const parsed = requestSchema.safeParse(body);
        if (!parsed.success) {
          return new Response(JSON.stringify({ error: "organizationId required" }), {
            status: 400,
            headers: { "Content-Type": "application/json" },
          });
        }
        const { organizationId, keywordId: filterKeywordId } = parsed.data;

        const keywords = await listActiveKeywordsWithSubreddits(organizationId);
        const filtered = filterKeywordId
          ? keywords.filter((k) => k.id === filterKeywordId)
          : keywords;

        let totalSaved = 0;
        let leadsCreated = 0;

        for (const keyword of filtered) {
          const subs = keyword.subreddits ?? [];
          for (const sub of subs) {
            try {
              const url = `https://www.reddit.com/r/${sub.name}/search.json?q=${encodeURIComponent(keyword.keyword)}&restrict_sr=1&sort=new&limit=25`;
              const res = await fetch(url, {
                headers: { "User-Agent": process.env.REDDIT_USER_AGENT ?? "vesper/1.0" },
              });
              if (!res.ok) continue;

              const data = (await res.json()) as RedditApiResponse;
              const children = data?.data?.children ?? [];

              for (const child of children) {
                const post = child.data;
                const { id: postId, isNew } = await upsertRedditPost({
                  orgId: organizationId,
                  redditId: post.id,
                  subreddit: post.subreddit,
                  title: post.title,
                  url: `https://reddit.com${post.permalink}`,
                  author: post.author,
                  score: post.score,
                  body: post.selftext?.slice(0, 1000) ?? "",
                  keywordId: keyword.id,
                });
                totalSaved++;

                // Only classify new posts to avoid redundant AI calls
                if (!isNew) continue;

                const classification = await classifyPost(
                  post.title,
                  post.selftext ?? "",
                  post.subreddit,
                );
                if (!classification) continue;

                await saveClassification(postId, {
                  intentType: classification.intent_type as IntentType,
                  intentScore: classification.intent_score,
                  engagementType: classification.engagement_type as EngagementType,
                  engagementScore: classification.engagement_score,
                });

                // Auto-create a lead for high-intent posts
                if (
                  classification.intent_type === "buying" ||
                  classification.intent_score >= 70
                ) {
                  try {
                    const fit =
                      classification.intent_score >= 80
                        ? "HIGH"
                        : classification.intent_score >= 60
                          ? "MEDIUM"
                          : "LOW";
                    await createLead(organizationId, {
                      company: `u/${post.author}`,
                      website: "",
                      whatTheyDo: `Reddit user in r/${post.subreddit}`,
                      ceo: post.author,
                      email: `reddit-${post.id}@placeholder.vesper`,
                      linkedin: "",
                      fit: fit as "HIGH" | "MEDIUM" | "LOW",
                      notes: `Auto-created from Reddit post: "${post.title.slice(0, 120)}"\n${`https://reddit.com${post.permalink}`}`,
                    });
                    leadsCreated++;
                  } catch {
                    // lead may already exist — skip
                  }
                }
              }
            } catch {
              // skip failed subreddit requests
            }
          }
        }

        return Response.json({ ok: true, totalSaved, leadsCreated });
      },
    },
  },
});
