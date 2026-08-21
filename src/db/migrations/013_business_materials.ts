import { db } from "../client";
import type { Migration } from "../migrations";

export const businessMaterialsMigration: Migration = {
  id: "013_business_materials",
  up: async () => {
    await db.execute(`CREATE TABLE IF NOT EXISTS business_materials (
      id TEXT PRIMARY KEY,
      organization_id TEXT NOT NULL REFERENCES organization(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      source_type TEXT NOT NULL CHECK (source_type IN ('paste', 'document', 'pdf')),
      raw_text TEXT NOT NULL,
      extracted_profile JSONB NOT NULL DEFAULT '{}'::jsonb,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )`);
    await db.execute("CREATE INDEX IF NOT EXISTS idx_business_materials_org ON business_materials(organization_id, created_at DESC)");
  },
};
