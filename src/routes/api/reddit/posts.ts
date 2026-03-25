import { createFileRoute } from "@tanstack/react-router";
import { initDb } from "~/db/schema";
import { listRedditPosts } from "~/db/queries/reddit";

export const Route = createFileRoute("/api/reddit/posts")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        await initDb();
        const url = new URL(request.url);
        const keywordId = url.searchParams.get("keywordId") ?? undefined;
        const posts = await listRedditPosts(keywordId);
        return Response.json(posts);
      },
    },
  },
});
