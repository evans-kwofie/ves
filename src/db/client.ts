import postgres from "postgres";

export const pgClient = postgres(process.env.DATABASE_URL ?? "postgresql://postgres:postgres@localhost:5432/nextreach", {
  onnotice: () => {},
});

// Convert ? placeholders to $1, $2, ... for Postgres
function toPositional(sql: string): string {
  let i = 0;
  return sql.replace(/\?/g, () => `$${++i}`);
}

export const db = {
  async execute(
    query: string | { sql: string; args?: unknown[] },
  ): Promise<{ rows: Record<string, unknown>[] }> {
    if (typeof query === "string") {
      const rows = await pgClient.unsafe(query);
      return { rows: rows as unknown as Record<string, unknown>[] };
    }
    const { sql: rawSql, args = [] } = query;
    const pgSql = toPositional(rawSql);
    const rows = await pgClient.unsafe(pgSql, args as postgres.ParameterOrJSON<never>[]);
    return { rows: rows as unknown as Record<string, unknown>[] };
  },

  async executeMultiple(queries: string): Promise<void> {
    const statements = queries
      .split(";")
      .map((s) => s.trim())
      .filter(Boolean);
    for (const stmt of statements) {
      try {
        await pgClient.unsafe(stmt);
      } catch (e) {
        const msg = (e as Error).message ?? "";
        // Ignore "already exists" errors during schema init
        if (
          msg.includes("already exists") ||
          msg.includes("duplicate column") ||
          msg.includes("does not exist")
        )
          continue;
        throw e;
      }
    }
  },
};
