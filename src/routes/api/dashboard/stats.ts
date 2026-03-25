import { createFileRoute } from "@tanstack/react-router";
import { initDb } from "~/db/schema";
import { getDashboardStats } from "~/db/queries/leads";
import { getBlogPostCount } from "~/db/queries/blog";
import { getRedditPostCount } from "~/db/queries/reddit";
import { listKeywords } from "~/db/queries/keywords";

export const Route = createFileRoute("/api/dashboard/stats")({
  server: {
    handlers: {
      GET: async () => {
        await initDb();
        const [leadStats, blogCount, redditCount, keywords] = await Promise.all([
          getDashboardStats(),
          getBlogPostCount(),
          getRedditPostCount(),
          listKeywords(),
        ]);

        return Response.json({
          ...leadStats,
          blogPosts: blogCount,
          redditPosts: redditCount,
          keywords: keywords.length,
          activeKeywords: keywords.filter((k) => k.isActive).length,
        });
      },
    },
  },
});
