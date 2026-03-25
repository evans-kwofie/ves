import { createFileRoute } from "@tanstack/react-router";
import { initDb } from "~/db/schema";
import { listKeywords, createKeyword } from "~/db/queries/keywords";
import { z } from "zod";

const createSchema = z.object({
  keyword: z.string().min(1).max(100),
  subreddits: z.array(z.string()).optional(),
});

export const Route = createFileRoute("/api/keywords/")({
  server: {
    handlers: {
      GET: async () => {
        await initDb();
        const keywords = await listKeywords();
        return Response.json(keywords);
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

        try {
          const keyword = await createKeyword(parsed.data.keyword, parsed.data.subreddits);
          return Response.json(keyword, { status: 201 });
        } catch (err) {
          const message = err instanceof Error ? err.message : "unknown_error";
          return new Response(JSON.stringify({ error: message }), {
            status: 409,
            headers: { "Content-Type": "application/json" },
          });
        }
      },
    },
  },
});
