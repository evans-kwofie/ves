import { createFileRoute } from "@tanstack/react-router";
import { getDashboardStats } from "~/db/queries/leads";
import { getBlogPostCount } from "~/db/queries/blog";
import { getRedditPostCount } from "~/db/queries/reddit";
import { listKeywords } from "~/db/queries/keywords";

export const Route = createFileRoute("/api/dashboard/stats")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const orgId = url.searchParams.get("organizationId");
        if (!orgId) return new Response(JSON.stringify({ error: "organizationId required" }), { status: 400, headers: { "Content-Type": "application/json" } });
        const [leadStats, blogCount, redditCount, keywords] = await Promise.all([
          getDashboardStats(orgId),
          getBlogPostCount(orgId),
          getRedditPostCount(orgId),
          listKeywords(orgId),
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
