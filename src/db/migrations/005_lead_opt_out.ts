import { db } from "../client";
import type { Migration } from "../migrations";
export const leadOptOutMigration: Migration = { id: "005_lead_opt_out", up: async () => {
  await db.execute("ALTER TABLE leads ADD COLUMN IF NOT EXISTS opted_out_at TIMESTAMPTZ");
} };
