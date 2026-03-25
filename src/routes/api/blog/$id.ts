import { createFileRoute } from "@tanstack/react-router";
import { initDb } from "~/db/schema";
import { getBlogPost, updateBlogPost, deleteBlogPost } from "~/db/queries/blog";
import { z } from "zod";

const updateSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  content: z.string().min(1).optional(),
  keywords: z.array(z.string()).optional(),
});

export const Route = createFileRoute("/api/blog/$id")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        await initDb();
        const post = await getBlogPost(params.id);
        if (!post) {
          return new Response(JSON.stringify({ error: "not_found" }), {
            status: 404,
            headers: { "Content-Type": "application/json" },
          });
        }
        return Response.json(post);
      },
      PUT: async ({ request, params }) => {
        await initDb();
        let body: unknown;
        try {
          body = await request.json();
        } catch {
          return new Response(JSON.stringify({ error: "invalid_json" }), {
            status: 400,
            headers: { "Content-Type": "application/json" },
          });
        }

        const parsed = updateSchema.safeParse(body);
        if (!parsed.success) {
          return new Response(JSON.stringify({ error: parsed.error.flatten() }), {
            status: 422,
            headers: { "Content-Type": "application/json" },
          });
        }

        const post = await updateBlogPost(params.id, parsed.data);
        return Response.json(post);
      },
      DELETE: async ({ params }) => {
        await initDb();
        await deleteBlogPost(params.id);
        return Response.json({ ok: true });
      },
    },
  },
});
