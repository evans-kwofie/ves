import { createFileRoute } from "@tanstack/react-router";
import { listActiveKeywordsWithSubreddits } from "~/db/queries/keywords";
import { upsertRedditPost, saveClassification } from "~/db/queries/reddit";
import { createLead } from "~/db/queries/leads";
import type { RedditApiResponse, IntentType, EngagementType } from "~/types/reddit";
import { z } from "zod";
import Anthropic from "@anthropic-ai/sdk";
import { auth } from "~/lib/auth";
import { getRequestHeaders } from "@tanstack/react-start/server";
import type { AgentVoiceConfig } from "~/routes/$workspaceId/settings/agent";

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
  icpContext: { companyName: string; mission: string },
): Promise<z.infer<typeof classificationSchema> | null> {
  const client = new Anthropic();

  const icpLine = icpContext.companyName
    ? `You are classifying posts on behalf of ${icpContext.companyName}.${icpContext.mission ? ` Their target customer and mission: ${icpContext.mission}` : ""}\n\nJudge relevance strictly against their ICP — a post is only "buying" or "pain" if the author could realistically be a customer of ${icpContext.companyName}. If the post is off-topic for their target market, classify it as "noise" even if it contains the search keyword.`
    : "Classify this Reddit post for a B2B sales team.";

  const prompt = `${icpLine}

Subreddit: r/${subreddit}
Title: ${title}
Body: ${body.slice(0, 500) || "(no body)"}

Return ONLY valid JSON with these fields:
- intent_type: one of "buying" (author is actively looking for something this company solves), "pain" (author has a problem this company solves), "discussion" (general topic discussion, not a direct opportunity), "noise" (off-topic or not relevant to this company's ICP)
- intent_score: 0-100 (how likely this specific person is a qualified lead for this company right now — 0 if wrong ICP, 100 if perfect signal)
- engagement_type: one of "helpful" (share expertise), "pitch" (soft product mention), "authority" (thought leadership), "question" (ask a clarifying question)
- engagement_score: 0-100 (how much value engaging with this post would generate for this company)

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

        // Load ICP context from org metadata
        let icpContext = { companyName: "", mission: "" };
        try {
          const headers = getRequestHeaders();
          const orgs = await auth.api.listOrganizations({ headers });
          const org = orgs?.find((o) => o.id === organizationId) ?? orgs?.[0];
          if (org?.metadata) {
            const meta = JSON.parse(org.metadata as string) as Record<string, string>;
            if (meta.agentVoice) {
              const voice = JSON.parse(meta.agentVoice) as Partial<AgentVoiceConfig>;
              icpContext = {
                companyName: voice.companyName ?? org.name ?? "",
                mission: voice.mission ?? "",
              };
            }
          }
        } catch {
          // proceed without ICP context — classification degrades gracefully
        }

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
                  icpContext,
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
