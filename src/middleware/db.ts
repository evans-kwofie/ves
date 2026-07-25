import { createMiddleware } from "@tanstack/react-start";
import { initDb } from "~/db/schema";
import { startDraftScheduler } from "~/lib/draft-scheduler";
import { startCampaignScheduler } from "~/lib/campaign-scheduler";

let initialized: Promise<void> | null = null;

export const dbMiddleware = createMiddleware().server(async ({ next }) => {
  if (!initialized) {
    initialized = initDb().then(() => {
      startDraftScheduler();
      startCampaignScheduler();
    });
  }
  await initialized;
  return next();
});
