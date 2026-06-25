import { createFileRoute } from "@tanstack/react-router";
import { listRedditPosts, clearRedditPosts } from "~/db/queries/reddit";

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
      DELETE: async ({ request }) => {
        let body: { organizationId?: string; keywordId?: string } = {};
        try { body = await request.json(); } catch { /* empty body ok */ }
        const { organizationId, keywordId } = body;
        if (!organizationId) return new Response(JSON.stringify({ error: "organizationId required" }), { status: 400, headers: { "Content-Type": "application/json" } });
        const deleted = await clearRedditPosts(organizationId, keywordId);
        return Response.json({ deleted });
      },
    },
  },
});
