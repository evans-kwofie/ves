import { createFileRoute } from "@tanstack/react-router";
import { listBlogPosts, createBlogPost } from "~/db/queries/blog";
import { z } from "zod";

const createSchema = z.object({
  organizationId: z.string().min(1),
  title: z.string().min(1).max(200),
  content: z.string().min(1),
  keywords: z.array(z.string()),
});

export const Route = createFileRoute("/api/blog/")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const orgId = url.searchParams.get("organizationId");
        if (!orgId) return new Response(JSON.stringify({ error: "organizationId required" }), { status: 400, headers: { "Content-Type": "application/json" } });
        const posts = await listBlogPosts(orgId);
        return Response.json(posts);
      },
      POST: async ({ request }) => {
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

        const { organizationId, ...input } = parsed.data;
        const post = await createBlogPost(organizationId, input);
        return Response.json(post, { status: 201 });
      },
    },
  },
});
