import { db } from "../client";
import type { Migration } from "../migrations";
export const productOffersMigration: Migration = { id: "008_product_offers", up: async () => {
  await db.execute("ALTER TABLE product_profiles ADD COLUMN IF NOT EXISTS pricing_model TEXT NOT NULL DEFAULT 'custom'");
  await db.execute("ALTER TABLE product_profiles ADD COLUMN IF NOT EXISTS price_amount NUMERIC");
  await db.execute("ALTER TABLE product_profiles ADD COLUMN IF NOT EXISTS price_currency TEXT");
  await db.execute("ALTER TABLE product_profiles ADD COLUMN IF NOT EXISTS offer_terms TEXT");
  await db.execute("ALTER TABLE product_profiles ADD COLUMN IF NOT EXISTS qualification_constraints TEXT");
  await db.execute("ALTER TABLE product_profiles ADD COLUMN IF NOT EXISTS proof_points JSONB NOT NULL DEFAULT '[]'::jsonb");
} };
