import { createFileRoute } from "@tanstack/react-router";
import { listKeywords, createKeyword } from "~/db/queries/keywords";
import { z } from "zod";

const createSchema = z.object({
  organizationId: z.string().min(1),
  keyword: z.string().min(1).max(100),
  subreddits: z.array(z.string()).optional(),
});

export const Route = createFileRoute("/api/keywords/")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const orgId = url.searchParams.get("organizationId");
        if (!orgId) return new Response(JSON.stringify({ error: "organizationId required" }), { status: 400, headers: { "Content-Type": "application/json" } });
        const keywords = await listKeywords(orgId);
        return Response.json(keywords);
      },
      POST: async ({ request }) => {
        let body: unknown;
        try {
          body = await request.json();
        } catch {
          return new Response(JSON.stringify({ error: "invalid_json" }), { status: 400, headers: { "Content-Type": "application/json" } });
        }

        const parsed = createSchema.safeParse(body);
        if (!parsed.success) {
          return new Response(JSON.stringify({ error: parsed.error.flatten() }), { status: 422, headers: { "Content-Type": "application/json" } });
        }

        try {
          const keyword = await createKeyword(parsed.data.organizationId, parsed.data.keyword, parsed.data.subreddits);
          return Response.json(keyword, { status: 201 });
        } catch (err) {
          const message = err instanceof Error ? err.message : "unknown_error";
          return new Response(JSON.stringify({ error: message }), { status: 409, headers: { "Content-Type": "application/json" } });
        }
      },
    },
  },
});
