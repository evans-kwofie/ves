import { db } from "../client";
import type { Migration } from "../migrations";

export const leadProvenanceMigration: Migration = {
  id: "001_lead_provenance",
  up: async () => {
    await db.execute("ALTER TABLE leads ADD COLUMN IF NOT EXISTS source_details JSONB NOT NULL DEFAULT '{}'::jsonb");
    await db.execute("ALTER TABLE leads ADD COLUMN IF NOT EXISTS last_verified_at TIMESTAMPTZ");
    await db.execute("ALTER TABLE leads ADD COLUMN IF NOT EXISTS enriched_at TIMESTAMPTZ");
  },
};
