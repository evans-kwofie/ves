import { createFileRoute } from "@tanstack/react-router";
import { deleteRedditPost } from "~/db/queries/reddit";

export const Route = createFileRoute("/api/reddit/posts/$id")({
  server: {
    handlers: {
      DELETE: async ({ params }) => {
        await deleteRedditPost(params.id);
        return new Response(null, { status: 204 });
      },
    },
  },
});
