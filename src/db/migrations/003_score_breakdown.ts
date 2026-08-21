import { db } from "../client";
import type { Migration } from "../migrations";

export const scoreBreakdownMigration: Migration = {
  id: "003_score_breakdown",
  up: async () => {
    await db.execute("ALTER TABLE leads ADD COLUMN IF NOT EXISTS score_breakdown JSONB NOT NULL DEFAULT '{}'::jsonb");
  },
};
