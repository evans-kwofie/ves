import { createFileRoute } from "@tanstack/react-router";
import { listActiveKeywordsWithSubreddits } from "~/db/queries/keywords";
import { upsertRedditPost, saveClassification } from "~/db/queries/reddit";
import { createLead, listLeads } from "~/db/queries/leads";
import type { IntentType, EngagementType } from "~/types/reddit";
import { z } from "zod";
import { geminiJSON } from "~/agent/tools/gemini";
import { auth } from "~/lib/auth";
import { getRequestHeaders } from "@tanstack/react-start/server";
import type { AgentVoiceConfig } from "~/routes/$workspaceId/settings/agent";

const requestSchema = z.object({
  organizationId: z.string().min(1),
  keywordId: z.string().optional(),
});

const STOP_WORDS = new Set([
  "the", "a", "an", "for", "to", "of", "in", "and", "or", "vs", "with",
  "by", "at", "on", "as", "is", "are", "was", "were", "has", "have", "had",
  "be", "been", "being", "that", "this", "these", "those", "it", "its", "not",
  "per", "our", "your", "my", "their", "how", "what", "why", "when", "which",
]);

function keywordTerms(keyword: string): string[] {
  return keyword
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .split(/\s+/)
    .filter((w) => w.length >= 3 && !STOP_WORDS.has(w));
}

export type ScanEvent =
  | { type: "start"; keywords: number }
  | { type: "fetch"; subreddit: string; keyword: string }
  | { type: "result"; subreddit: string; matched: number }
  | { type: "fetch_error"; subreddit: string; status: number }
  | { type: "classify"; author: string; title: string }
  | { type: "lead"; author: string; fit: "HIGH" | "MEDIUM"; subreddit: string }
  | { type: "done"; totalSaved: number; leadsCreated: number };

interface PullPushPost {
  id: string;
  title: string;
  selftext: string;
  author: string;
  subreddit: string;
  permalink: string;
  score: number;
  created_utc: number;
}

const classificationSchema = z.object({
  intent_type: z.enum(["buying", "pain", "discussion", "noise"]),
  intent_score: z.number().int().min(0).max(100),
  engagement_type: z.enum(["helpful", "pitch", "authority", "question"]),
  engagement_score: z.number().int().min(0).max(100),
});

async function fetchOpComments(subreddit: string, postId: string, author: string): Promise<string> {
  try {
    const url = `https://www.reddit.com/r/${subreddit}/comments/${postId}.json?limit=20&depth=1`;
    const res = await fetch(url, {
      headers: { "User-Agent": process.env.REDDIT_USER_AGENT ?? "nextreach/1.0" },
    });
    if (!res.ok) return "";
    const data = (await res.json()) as unknown[][];
    const commentListing = data?.[1] as { data?: { children?: { data?: { author?: string; body?: string } }[] } } | undefined;
    const comments = commentListing?.data?.children ?? [];
    return comments
      .filter((c) => c.data?.author === author && c.data?.body)
      .map((c) => c.data!.body!)
      .slice(0, 5)
      .join("\n\n");
  } catch {
    return "";
  }
}

async function classifyPost(
  title: string,
  body: string,
  subreddit: string,
  icpContext: { companyName: string; mission: string },
  opComments?: string,
): Promise<z.infer<typeof classificationSchema> | null> {
  const icpLine = icpContext.companyName
    ? `You are classifying posts on behalf of ${icpContext.companyName}.${icpContext.mission ? ` Their target customer and mission: ${icpContext.mission}` : ""}\n\nJudge relevance strictly against their ICP — a post is only "buying" or "pain" if the author could realistically be a customer of ${icpContext.companyName}. If the post is off-topic for their target market, classify it as "noise" even if it contains the search keyword.`
    : "Classify this Reddit post for a B2B sales team.";

  const prompt = `${icpLine}

Subreddit: r/${subreddit}
Title: ${title}
Post body: ${body.slice(0, 2000) || "(no body)"}${opComments ? `\n\nOP's own comments in the thread:\n${opComments.slice(0, 1000)}` : ""}

Return ONLY valid JSON with these fields:
- intent_type: one of "buying" (author is actively looking for something this company solves), "pain" (author has a problem this company solves), "discussion" (general topic discussion, not a direct opportunity), "noise" (off-topic or not relevant to this company's ICP)
- intent_score: 0-100 (how likely this specific person is a qualified lead for this company right now — 0 if wrong ICP, 100 if perfect signal)
- engagement_type: one of "helpful" (share expertise), "pitch" (soft product mention), "authority" (thought leadership), "question" (ask a clarifying question)
- engagement_score: 0-100 (how much value engaging with this post would generate for this company)

JSON only, no markdown.`;

  try {
    const raw = await geminiJSON<z.infer<typeof classificationSchema>>(prompt, {
      maxTokens: 150,
    });
    if (!raw) return null;
    const parsed = classificationSchema.safeParse(raw);
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

        // Load everything upfront before the stream opens
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
          // proceed without ICP context
        }

        const keywords = await listActiveKeywordsWithSubreddits(organizationId);
        const filtered = filterKeywordId
          ? keywords.filter((k) => k.id === filterKeywordId)
          : keywords;

        const existingLeads = await listLeads(organizationId);
        const seenAuthors = new Set(
          existingLeads
            .filter((l) => l.source === "reddit")
            .map((l) => l.ceo.replace(/^u\//, "").toLowerCase())
        );


        const encoder = new TextEncoder();

        const stream = new ReadableStream<Uint8Array>({
          async start(controller) {
            const emit = (event: ScanEvent) => {
              controller.enqueue(encoder.encode(JSON.stringify(event) + "\n"));
            };

            let totalSaved = 0;
            let leadsCreated = 0;

            try {
              emit({ type: "start", keywords: filtered.length });

              for (const keyword of filtered) {
                const subs = keyword.subreddits ?? [];
                const terms = keywordTerms(keyword.keyword);

                for (const sub of subs) {
                  emit({ type: "fetch", subreddit: sub.name, keyword: keyword.keyword });
                  try {
                    const after = Math.floor(Date.now() / 1000) - 90 * 24 * 60 * 60;
                    const params = new URLSearchParams({
                      subreddit: sub.name,
                      q: terms.length > 0 ? terms.join(" ") : keyword.keyword,
                      size: "100",
                      sort: "desc",
                      sort_type: "created_utc",
                      after: String(after),
                    });
                    const res = await fetch(`https://api.pullpush.io/reddit/search/submission/?${params}`, {
                      headers: { "User-Agent": process.env.REDDIT_USER_AGENT ?? "nextreach/1.0" },
                    });

                    if (!res.ok) {
                      emit({ type: "fetch_error", subreddit: sub.name, status: res.status });
                      continue;
                    }

                    const data = (await res.json()) as { data: PullPushPost[] };
                    const posts = data?.data ?? [];
                    emit({ type: "result", subreddit: sub.name, matched: posts.length });

                    for (const post of posts) {
                      const postedAt = post.created_utc
                        ? new Date(post.created_utc * 1000).toISOString()
                        : null;
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
                        postedAt,
                      });
                      totalSaved++;

                      if (!isNew) continue;

                      emit({ type: "classify", author: post.author, title: post.title.slice(0, 80) });

                      const opComments = await fetchOpComments(post.subreddit, post.id, post.author);
                      const classification = await classifyPost(
                        post.title,
                        post.selftext ?? "",
                        post.subreddit,
                        icpContext,
                        opComments,
                      );

                      if (!classification) continue;

                      await saveClassification(postId, {
                        intentType: classification.intent_type as IntentType,
                        intentScore: classification.intent_score,
                        engagementType: classification.engagement_type as EngagementType,
                        engagementScore: classification.engagement_score,
                      });

                      const authorKey = post.author.toLowerCase();
                      if (
                        classification.intent_type === "buying" &&
                        classification.intent_score >= 80 &&
                        !seenAuthors.has(authorKey)
                      ) {
                        try {
                          const fit = classification.intent_score >= 90 ? "HIGH" : "MEDIUM";
                          await createLead(organizationId, {
                            company: `u/${post.author}`,
                            website: `https://reddit.com/user/${post.author}`,
                            whatTheyDo: `Reddit user in r/${post.subreddit}`,
                            ceo: post.author,
                            email: `reddit-${post.author}@placeholder.nextreach`,
                            linkedin: "",
                            fit: fit as "HIGH" | "MEDIUM",
                            notes: `"${post.title.slice(0, 200)}"\nhttps://reddit.com${post.permalink}`,
                          });
                          seenAuthors.add(authorKey);
                          leadsCreated++;
                          emit({ type: "lead", author: post.author, fit: fit as "HIGH" | "MEDIUM", subreddit: post.subreddit });
                        } catch (err) {
                          console.error(`[reddit:stream] failed to create lead for u/${post.author}:`, err);
                        }
                      }
                    }
                  } catch (err) {
                    console.error(`[reddit:stream] error on r/${sub.name}:`, err);
                    emit({ type: "fetch_error", subreddit: sub.name, status: 0 });
                  }
                }
              }

              emit({ type: "done", totalSaved, leadsCreated });
            } finally {
              controller.close();
            }
          },
        });

        return new Response(stream, {
          headers: {
            "Content-Type": "application/x-ndjson",
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
          },
        });
      },
    },
  },
});
