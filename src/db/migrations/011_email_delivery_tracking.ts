import { db } from "../client";
import type { Migration } from "../migrations";
export const emailDeliveryTrackingMigration: Migration = { id: "011_email_delivery_tracking", up: async () => {
  await db.execute("ALTER TABLE campaign_drafts ADD COLUMN IF NOT EXISTS delivered_at TIMESTAMPTZ");
} };
