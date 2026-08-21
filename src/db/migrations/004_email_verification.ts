import { db } from "../client";
import type { Migration } from "../migrations";
export const emailVerificationMigration: Migration = { id: "004_email_verification", up: async () => {
  await db.execute("ALTER TABLE leads ADD COLUMN IF NOT EXISTS email_verification_status TEXT");
  await db.execute("ALTER TABLE leads ADD COLUMN IF NOT EXISTS email_verification_confidence INTEGER");
  await db.execute("ALTER TABLE leads ADD COLUMN IF NOT EXISTS email_verification_provider TEXT");
  await db.execute("ALTER TABLE leads ADD COLUMN IF NOT EXISTS email_verified_at TIMESTAMPTZ");
} };
