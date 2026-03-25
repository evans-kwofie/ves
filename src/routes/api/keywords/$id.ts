import { createFileRoute } from "@tanstack/react-router";
import { initDb } from "~/db/schema";
import { updateKeyword, deleteKeyword } from "~/db/queries/keywords";
import { z } from "zod";

const updateSchema = z.object({
  keyword: z.string().min(1).max(100).optional(),
  isActive: z.boolean().optional(),
});

export const Route = createFileRoute("/api/keywords/$id")({
  server: {
    handlers: {
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

        await updateKeyword(params.id, parsed.data);
        return Response.json({ ok: true });
      },
      DELETE: async ({ params }) => {
        await initDb();
        await deleteKeyword(params.id);
        return Response.json({ ok: true });
      },
    },
  },
});
