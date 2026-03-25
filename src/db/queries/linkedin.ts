import { v4 as uuidv4 } from "uuid";
import { db } from "../client";
import type { LinkedInPost } from "~/types/linkedin";

function rowToPost(row: Record<string, unknown>): LinkedInPost {
  return {
    id: row.id as string,
    content: row.content as string,
    keywordId: (row.keyword_id as string | null) ?? null,
    createdAt: row.created_at as string,
  };
}

export async function listLinkedInPosts(): Promise<LinkedInPost[]> {
  const result = await db.execute(
    "SELECT * FROM linkedin_posts ORDER BY created_at DESC LIMIT 50",
  );
  return result.rows.map((r) => rowToPost(r as Record<string, unknown>));
}

export async function createLinkedInPost(
  content: string,
  keywordId: string | null,
): Promise<LinkedInPost> {
  const id = uuidv4();
  const now = new Date().toISOString();

  await db.execute({
    sql: "INSERT INTO linkedin_posts (id, content, keyword_id, created_at) VALUES (?, ?, ?, ?)",
    args: [id, content, keywordId, now],
  });

  return { id, content, keywordId, createdAt: now };
}

export async function deleteLinkedInPost(id: string): Promise<void> {
  await db.execute({ sql: "DELETE FROM linkedin_posts WHERE id = ?", args: [id] });
}
