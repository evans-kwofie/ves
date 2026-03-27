import { createFileRoute } from "@tanstack/react-router";
import { addSubreddit } from "~/db/queries/keywords";
import { z } from "zod";

const createSchema = z.object({
  keywordId: z.string().uuid(),
  name: z.string().min(1).max(80),
});

export const Route = createFileRoute("/api/subreddits/")({
  server: {
    handlers: {
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

        const subreddit = await addSubreddit(parsed.data.keywordId, parsed.data.name);
        return Response.json(subreddit, { status: 201 });
      },
    },
  },
});
