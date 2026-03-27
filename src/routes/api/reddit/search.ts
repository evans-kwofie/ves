import { createFileRoute } from "@tanstack/react-router";
import { listActiveKeywordsWithSubreddits } from "~/db/queries/keywords";
import { upsertRedditPost } from "~/db/queries/reddit";
import type { RedditApiResponse } from "~/types/reddit";
import { z } from "zod";

const requestSchema = z.object({
  organizationId: z.string().min(1),
  keywordId: z.string().optional(),
});

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
          return new Response(JSON.stringify({ error: "organizationId required" }), { status: 400, headers: { "Content-Type": "application/json" } });
        }
        const { organizationId, keywordId: filterKeywordId } = parsed.data;

        const keywords = await listActiveKeywordsWithSubreddits(organizationId);
        const filtered = filterKeywordId
          ? keywords.filter((k) => k.id === filterKeywordId)
          : keywords;

        let totalSaved = 0;

        for (const keyword of filtered) {
          const subs = keyword.subreddits ?? [];
          for (const sub of subs) {
            try {
              const url = `https://www.reddit.com/r/${sub.name}/search.json?q=${encodeURIComponent(keyword.keyword)}&restrict_sr=1&sort=new&limit=25`;
              const res = await fetch(url, {
                headers: {
                  "User-Agent": process.env.REDDIT_USER_AGENT ?? "vesper/1.0",
                },
              });

              if (!res.ok) continue;

              const data = (await res.json()) as RedditApiResponse;
              const children = data?.data?.children ?? [];

              for (const child of children) {
                const post = child.data;
                await upsertRedditPost({
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
              }
            } catch {
              // skip failed subreddit requests
            }
          }
        }

        return Response.json({ ok: true, totalSaved });
      },
    },
  },
});
