import { createFileRoute } from "@tanstack/react-router";
import { deleteSubreddit } from "~/db/queries/keywords";

export const Route = createFileRoute("/api/subreddits/$id")({
  server: {
    handlers: {
      DELETE: async ({ params }) => {
        await deleteSubreddit(params.id);
        return Response.json({ ok: true });
      },
    },
  },
});
