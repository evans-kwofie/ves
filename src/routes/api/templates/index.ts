import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { listTemplates, createTemplate } from "~/db/queries/templates";

const createSchema = z.object({
  organizationId: z.string().min(1),
  name: z.string().min(1),
  channel: z.enum(["email", "linkedin", "instagram"]),
  subject: z.string().nullable().optional(),
  body: z.string(),
  brandColor: z.string().nullable().optional(),
  showLogo: z.boolean().optional(),
  variantBSubject: z.string().nullable().optional(),
  variantBBody: z.string().nullable().optional(),
});

export const Route = createFileRoute("/api/templates/")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const orgId = new URL(request.url).searchParams.get("orgId");
        if (!orgId) return new Response(JSON.stringify({ error: "orgId required" }), { status: 400, headers: { "Content-Type": "application/json" } });
        const templates = await listTemplates(orgId);
        return Response.json(templates);
      },
      POST: async ({ request }) => {
        let body: unknown;
        try { body = await request.json(); } catch {
          return new Response(JSON.stringify({ error: "invalid_json" }), { status: 400, headers: { "Content-Type": "application/json" } });
        }
        const parsed = createSchema.safeParse(body);
        if (!parsed.success) return new Response(JSON.stringify({ error: parsed.error.flatten() }), { status: 422, headers: { "Content-Type": "application/json" } });
        const template = await createTemplate(parsed.data);
        return Response.json(template, { status: 201 });
      },
    },
  },
});
