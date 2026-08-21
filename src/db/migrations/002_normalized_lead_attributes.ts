import { db } from "../client";
import type { Migration } from "../migrations";

export const normalizedLeadAttributesMigration: Migration = {
  id: "002_normalized_lead_attributes",
  up: async () => {
    await db.execute("ALTER TABLE leads ADD COLUMN IF NOT EXISTS role TEXT");
    await db.execute("ALTER TABLE leads ADD COLUMN IF NOT EXISTS industry TEXT");
    await db.execute("ALTER TABLE leads ADD COLUMN IF NOT EXISTS company_size TEXT");
    await db.execute("ALTER TABLE leads ADD COLUMN IF NOT EXISTS location TEXT");
    await db.execute("ALTER TABLE leads ADD COLUMN IF NOT EXISTS intent_signals JSONB NOT NULL DEFAULT '[]'::jsonb");
    await db.execute("ALTER TABLE leads ADD COLUMN IF NOT EXISTS engagement_history JSONB NOT NULL DEFAULT '[]'::jsonb");
    await db.execute("CREATE INDEX IF NOT EXISTS idx_leads_industry ON leads(industry)");
    await db.execute("CREATE INDEX IF NOT EXISTS idx_leads_location ON leads(location)");
  },
};
