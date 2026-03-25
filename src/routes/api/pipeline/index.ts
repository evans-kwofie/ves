import { createFileRoute } from "@tanstack/react-router";
import { initDb } from "~/db/schema";
import { getPipeline } from "~/db/queries/leads";

export const Route = createFileRoute("/api/pipeline/")({
  server: {
    handlers: {
      GET: async () => {
        await initDb();
        const pipeline = await getPipeline();
        return Response.json(pipeline);
      },
    },
  },
});
