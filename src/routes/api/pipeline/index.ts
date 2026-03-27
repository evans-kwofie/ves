import { createFileRoute } from "@tanstack/react-router";
import { getPipeline } from "~/db/queries/leads";

export const Route = createFileRoute("/api/pipeline/")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const orgId = url.searchParams.get("organizationId");
        if (!orgId) return new Response(JSON.stringify({ error: "organizationId required" }), { status: 400, headers: { "Content-Type": "application/json" } });
        const pipeline = await getPipeline(orgId);
        return Response.json(pipeline);
      },
    },
  },
});
