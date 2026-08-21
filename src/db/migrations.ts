import { db } from "./client";

export interface Migration {
  id: string;
  up: () => Promise<void>;
}

/** Runs each registered migration once and records it in PostgreSQL. */
export async function runMigrations(migrations: readonly Migration[]): Promise<void> {
  await db.execute(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);

  for (const migration of migrations) {
    const existing = await db.execute({
      sql: "SELECT id FROM schema_migrations WHERE id = ? LIMIT 1",
      args: [migration.id],
    });
    if (existing.rows.length > 0) continue;

    // The migration is recorded only after every statement completes. If a
    // deploy is interrupted, its id remains absent and the idempotent migration
    // will safely be retried on the next boot.
    await migration.up();
    await db.execute({
      sql: "INSERT INTO schema_migrations (id) VALUES (?)",
      args: [migration.id],
    });
  }
}
