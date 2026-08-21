import { db } from "../client";
import type { Migration } from "../migrations";

export const campaignSendPolicyMigration: Migration = { id: "009_campaign_send_policy", up: async () => {
  await db.execute("ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS batch_size INTEGER NOT NULL DEFAULT 25");
  await db.execute("ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS timezone TEXT NOT NULL DEFAULT 'UTC'");
  await db.execute("ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS send_window_start INTEGER NOT NULL DEFAULT 8");
  await db.execute("ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS send_window_end INTEGER NOT NULL DEFAULT 18");
  await db.execute("ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS weekdays_only BOOLEAN NOT NULL DEFAULT true");
  await db.execute("ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS channel_send_rules JSONB NOT NULL DEFAULT '{}'::jsonb");
} };
