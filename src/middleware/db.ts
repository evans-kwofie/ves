import { createMiddleware } from "@tanstack/react-start";
import { initDb } from "~/db/schema";
import { startDraftScheduler } from "~/lib/draft-scheduler";
import { startCampaignScheduler } from "~/lib/campaign-scheduler";
import { startEnrichmentScheduler } from "~/lib/enrichment-scheduler";

let initialized: Promise<void> | null = null;

export const dbMiddleware = createMiddleware().server(async ({ next }) => {
  if (!initialized) {
    initialized = initDb().then(() => {
      startDraftScheduler();
      startCampaignScheduler();
      startEnrichmentScheduler();
    });
  }
  await initialized;
  return next();
});
