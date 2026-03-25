import { createFileRoute } from "@tanstack/react-router";
import { initDb } from "~/db/schema";
import { listBlogPosts, createBlogPost } from "~/db/queries/blog";
import { z } from "zod";

const createSchema = z.object({
  title: z.string().min(1).max(200),
  content: z.string().min(1),
  keywords: z.array(z.string()),
});

export const Route = createFileRoute("/api/blog/")({
  server: {
    handlers: {
      GET: async () => {
        await initDb();
        const posts = await listBlogPosts();
        return Response.json(posts);
      },
      POST: async ({ request }) => {
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

        const parsed = createSchema.safeParse(body);
        if (!parsed.success) {
          return new Response(JSON.stringify({ error: parsed.error.flatten() }), {
            status: 422,
            headers: { "Content-Type": "application/json" },
          });
        }

        const post = await createBlogPost(parsed.data);
        return Response.json(post, { status: 201 });
      },
    },
  },
});
