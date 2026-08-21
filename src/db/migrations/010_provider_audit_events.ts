import { db } from "../client";
import type { Migration } from "../migrations";
export const providerAuditEventsMigration: Migration = { id: "010_provider_audit_events", up: async () => {
  await db.execute(`CREATE TABLE IF NOT EXISTS provider_audit_events (
    id TEXT PRIMARY KEY, provider TEXT NOT NULL, event_type TEXT NOT NULL, outcome TEXT NOT NULL,
    lead_id TEXT, campaign_draft_id TEXT, provider_message_id TEXT, detail JSONB NOT NULL DEFAULT '{}'::jsonb, created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`);
  await db.execute("CREATE INDEX IF NOT EXISTS idx_provider_audit_events_draft ON provider_audit_events(campaign_draft_id, created_at DESC)");
} };
