import { db } from "../client";
import type { Migration } from "../migrations";
export const campaignExactScheduleMigration: Migration = { id: "014_campaign_exact_schedule", up: async () => {
  await db.execute("ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS scheduled_start_at TIMESTAMPTZ");
  await db.execute("CREATE INDEX IF NOT EXISTS idx_campaigns_scheduled_start ON campaigns(status, scheduled_start_at)");
} };
