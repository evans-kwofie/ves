import { createFileRoute } from "@tanstack/react-router";
import { deleteLinkedInPost, updateLinkedInPost } from "~/db/queries/linkedin";

export const Route = createFileRoute("/api/linkedin/$id")({
  server: {
    handlers: {
      PATCH: async ({ request, params }) => {
        const { content } = (await request.json()) as { content?: string };
        if (!content?.trim()) {
          return new Response(JSON.stringify({ error: "content required" }), { status: 422 });
        }
        const post = await updateLinkedInPost(params.id, content.trim());
        return Response.json({ post });
      },
      DELETE: async ({ params }) => {
        await deleteLinkedInPost(params.id);
        return Response.json({ ok: true });
      },
    },
  },
});
