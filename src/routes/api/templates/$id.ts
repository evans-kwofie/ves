import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { updateTemplate, deleteTemplate } from "~/db/queries/templates";

const updateSchema = z.object({
  name: z.string().min(1).optional(),
  channel: z.enum(["email", "linkedin", "instagram"]).optional(),
  subject: z.string().nullable().optional(),
  body: z.string().optional(),
  brandColor: z.string().nullable().optional(),
  showLogo: z.boolean().optional(),
  variantBSubject: z.string().nullable().optional(),
  variantBBody: z.string().nullable().optional(),
});

export const Route = createFileRoute("/api/templates/$id")({
  server: {
    handlers: {
      PUT: async ({ request, params }) => {
        let body: unknown;
        try { body = await request.json(); } catch {
          return new Response(JSON.stringify({ error: "invalid_json" }), { status: 400, headers: { "Content-Type": "application/json" } });
        }
        const parsed = updateSchema.safeParse(body);
        if (!parsed.success) return new Response(JSON.stringify({ error: parsed.error.flatten() }), { status: 422, headers: { "Content-Type": "application/json" } });
        await updateTemplate(params.id, parsed.data);
        return Response.json({ ok: true });
      },
      DELETE: async ({ params }) => {
        await deleteTemplate(params.id);
        return new Response(null, { status: 204 });
      },
    },
  },
});
