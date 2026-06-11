import { createFileRoute } from "@tanstack/react-router";
import { listDrafts, deleteDraftsForCampaign } from "~/db/queries/drafts";

export const Route = createFileRoute("/api/campaigns/$id/drafts")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const drafts = await listDrafts(params.id);
        return Response.json(drafts);
      },
      DELETE: async ({ params }) => {
        await deleteDraftsForCampaign(params.id);
        return Response.json({ ok: true });
      },
    },
  },
});
