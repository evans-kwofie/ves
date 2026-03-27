import { createFileRoute } from "@tanstack/react-router";
import { listRedditPosts } from "~/db/queries/reddit";

export const Route = createFileRoute("/api/reddit/posts")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const orgId = url.searchParams.get("organizationId");
        if (!orgId) return new Response(JSON.stringify({ error: "organizationId required" }), { status: 400, headers: { "Content-Type": "application/json" } });
        const keywordId = url.searchParams.get("keywordId") ?? undefined;
        const posts = await listRedditPosts(orgId, keywordId);
        return Response.json(posts);
      },
    },
  },
});
