import { db } from "../client";
import type { Migration } from "../migrations";
export const draftGenerationContextMigration: Migration = { id: "006_draft_generation_context", up: async () => {
  await db.execute("ALTER TABLE campaign_drafts ADD COLUMN IF NOT EXISTS generation_context JSONB NOT NULL DEFAULT '{}'::jsonb");
} };
