import { db } from "../client";
import type { Migration } from "../migrations";
export const productProfilesMigration: Migration = { id: "007_product_profiles", up: async () => {
  await db.execute(`CREATE TABLE IF NOT EXISTS product_profiles (
    id TEXT PRIMARY KEY, organization_id TEXT NOT NULL, name TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '', benefits JSONB NOT NULL DEFAULT '[]'::jsonb,
    ideal_customer TEXT, created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`);
  await db.execute("CREATE INDEX IF NOT EXISTS idx_product_profiles_org ON product_profiles(organization_id)");
} };
