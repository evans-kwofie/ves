import { v4 as uuidv4 } from "uuid";
import { db } from "../client";
import type { RedditPost } from "~/types/reddit";

function rowToPost(row: Record<string, unknown>): RedditPost {
  return {
    id: row.id as string,
    redditId: row.reddit_id as string,
    subreddit: row.subreddit as string,
    title: row.title as string,
    url: row.url as string,
    author: row.author as string,
    score: row.score as number,
    body: row.body as string,
    keywordId: (row.keyword_id as string | null) ?? null,
    replySuggestion: (row.reply_suggestion as string | null) ?? null,
    fetchedAt: row.fetched_at as string,
  };
}

export async function listRedditPosts(orgId: string, keywordId?: string): Promise<RedditPost[]> {
  if (keywordId) {
    const result = await db.execute({
      sql: "SELECT * FROM reddit_posts WHERE organization_id = ? AND keyword_id = ? ORDER BY score DESC, fetched_at DESC",
      args: [orgId, keywordId],
    });
    return result.rows.map((r) => rowToPost(r as Record<string, unknown>));
  }
  const result = await db.execute({
    sql: "SELECT * FROM reddit_posts WHERE organization_id = ? ORDER BY score DESC, fetched_at DESC LIMIT 100",
    args: [orgId],
  });
  return result.rows.map((r) => rowToPost(r as Record<string, unknown>));
}

export async function upsertRedditPost(post: {
  orgId: string;
  redditId: string;
  subreddit: string;
  title: string;
  url: string;
  author: string;
  score: number;
  body: string;
  keywordId: string | null;
}): Promise<void> {
  const now = new Date().toISOString();
  const existing = await db.execute({
    sql: "SELECT id FROM reddit_posts WHERE reddit_id = ?",
    args: [post.redditId],
  });

  if (existing.rows.length > 0) {
    await db.execute({
      sql: "UPDATE reddit_posts SET score = ?, fetched_at = ? WHERE reddit_id = ?",
      args: [post.score, now, post.redditId],
    });
  } else {
    const id = uuidv4();
    await db.execute({
      sql: `INSERT INTO reddit_posts (id, organization_id, reddit_id, subreddit, title, url, author, score, body, keyword_id, fetched_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [id, post.orgId, post.redditId, post.subreddit, post.title, post.url, post.author, post.score, post.body, post.keywordId, now],
    });
  }
}

export async function saveReplySuggestion(id: string, suggestion: string): Promise<void> {
  await db.execute({
    sql: "UPDATE reddit_posts SET reply_suggestion = ? WHERE id = ?",
    args: [suggestion, id],
  });
}

export async function getRedditPostCount(orgId: string): Promise<number> {
  const result = await db.execute({
    sql: "SELECT COUNT(*) as count FROM reddit_posts WHERE organization_id = ?",
    args: [orgId],
  });
  return (result.rows[0] as Record<string, unknown>).count as number;
}
