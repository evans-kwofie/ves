import { v4 as uuidv4 } from "uuid";
import { db } from "../client";
import type { Keyword, Subreddit } from "~/types/keyword";

function rowToKeyword(row: Record<string, unknown>): Keyword {
  return {
    id: row.id as string,
    keyword: row.keyword as string,
    isActive: (row.is_active as number) === 1,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

function rowToSubreddit(row: Record<string, unknown>): Subreddit {
  return {
    id: row.id as string,
    name: row.name as string,
    keywordId: row.keyword_id as string,
    createdAt: row.created_at as string,
  };
}

export async function listKeywords(orgId: string): Promise<Keyword[]> {
  const result = await db.execute({
    sql: "SELECT * FROM keywords WHERE organization_id = ? ORDER BY created_at DESC",
    args: [orgId],
  });
  const keywords = result.rows.map((r) => rowToKeyword(r as Record<string, unknown>));

  const subResult = await db.execute("SELECT * FROM subreddits ORDER BY created_at ASC");
  const subreddits = subResult.rows.map((r) => rowToSubreddit(r as Record<string, unknown>));

  return keywords.map((k) => ({
    ...k,
    subreddits: subreddits.filter((s) => s.keywordId === k.id),
  }));
}

export async function getKeyword(id: string): Promise<Keyword | null> {
  const result = await db.execute({ sql: "SELECT * FROM keywords WHERE id = ?", args: [id] });
  if (result.rows.length === 0) return null;
  const keyword = rowToKeyword(result.rows[0] as Record<string, unknown>);
  const subResult = await db.execute({
    sql: "SELECT * FROM subreddits WHERE keyword_id = ? ORDER BY created_at ASC",
    args: [id],
  });
  keyword.subreddits = subResult.rows.map((r) => rowToSubreddit(r as Record<string, unknown>));
  return keyword;
}

export async function createKeyword(
  orgId: string,
  keyword: string,
  subreddits: string[] = [],
): Promise<Keyword> {
  const id = uuidv4();
  const now = new Date().toISOString();

  await db.execute({
    sql: "INSERT INTO keywords (id, organization_id, keyword, is_active, created_at, updated_at) VALUES (?, ?, ?, 1, ?, ?)",
    args: [id, orgId, keyword.trim().toLowerCase(), now, now],
  });

  const subredditRows: Subreddit[] = [];
  for (const name of subreddits) {
    const sub = await addSubreddit(id, name);
    subredditRows.push(sub);
  }

  return {
    id,
    keyword: keyword.trim().toLowerCase(),
    isActive: true,
    createdAt: now,
    updatedAt: now,
    subreddits: subredditRows,
  };
}

export async function updateKeyword(
  id: string,
  updates: { keyword?: string; isActive?: boolean },
): Promise<void> {
  const now = new Date().toISOString();
  const fields: string[] = ["updated_at = ?"];
  const args: (string | number)[] = [now];

  if (updates.keyword !== undefined) {
    fields.push("keyword = ?");
    args.push(updates.keyword.trim().toLowerCase());
  }
  if (updates.isActive !== undefined) {
    fields.push("is_active = ?");
    args.push(updates.isActive ? 1 : 0);
  }

  args.push(id);
  await db.execute({ sql: `UPDATE keywords SET ${fields.join(", ")} WHERE id = ?`, args });
}

export async function deleteKeyword(id: string): Promise<void> {
  await db.execute({ sql: "DELETE FROM keywords WHERE id = ?", args: [id] });
}

export async function addSubreddit(keywordId: string, name: string): Promise<Subreddit> {
  const id = uuidv4();
  const now = new Date().toISOString();
  const cleanName = name.replace(/^r\//, "").trim().toLowerCase();

  await db.execute({
    sql: "INSERT INTO subreddits (id, name, keyword_id, created_at) VALUES (?, ?, ?, ?)",
    args: [id, cleanName, keywordId, now],
  });

  return { id, name: cleanName, keywordId, createdAt: now };
}

export async function deleteSubreddit(id: string): Promise<void> {
  await db.execute({ sql: "DELETE FROM subreddits WHERE id = ?", args: [id] });
}

export async function listActiveKeywordsWithSubreddits(orgId: string): Promise<Keyword[]> {
  const result = await db.execute({
    sql: "SELECT * FROM keywords WHERE organization_id = ? AND is_active = 1 ORDER BY created_at DESC",
    args: [orgId],
  });
  const keywords = result.rows.map((r) => rowToKeyword(r as Record<string, unknown>));

  const subResult = await db.execute("SELECT * FROM subreddits ORDER BY created_at ASC");
  const subreddits = subResult.rows.map((r) => rowToSubreddit(r as Record<string, unknown>));

  return keywords.map((k) => ({
    ...k,
    subreddits: subreddits.filter((s) => s.keywordId === k.id),
  }));
}
