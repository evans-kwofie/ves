import { db } from "../client";
import type { Migration } from "../migrations";

/** Enforce the normalized identities used by every lead-ingestion path. */
export const leadDeduplicationIndexesMigration: Migration = {
  id: "012_lead_deduplication_indexes",
  up: async () => {
    await db.execute(`CREATE UNIQUE INDEX IF NOT EXISTS idx_leads_org_normalized_email
      ON leads (organization_id, LOWER(BTRIM(email)))
      WHERE email IS NOT NULL AND BTRIM(email) <> ''`);
    await db.execute(`CREATE UNIQUE INDEX IF NOT EXISTS idx_leads_org_company_contact
      ON leads (organization_id, LOWER(BTRIM(company)), LOWER(BTRIM(ceo)))
      WHERE BTRIM(ceo) <> ''`);
  },
};
