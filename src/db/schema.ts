import { db } from "./client";

export async function initDb(): Promise<void> {
  await db.executeMultiple(`
    CREATE TABLE IF NOT EXISTS keywords (
      id TEXT PRIMARY KEY,
      keyword TEXT NOT NULL UNIQUE,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS subreddits (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      keyword_id TEXT NOT NULL REFERENCES keywords(id) ON DELETE CASCADE,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS leads (
      id TEXT PRIMARY KEY,
      company TEXT NOT NULL,
      website TEXT NOT NULL,
      what_they_do TEXT NOT NULL,
      ceo TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      linkedin TEXT NOT NULL DEFAULT '',
      fit TEXT NOT NULL CHECK(fit IN ('HIGH','MEDIUM','LOW')),
      status TEXT NOT NULL DEFAULT 'not_contacted',
      email_sent_at TEXT,
      linkedin_sent_at TEXT,
      replied_at TEXT,
      notes TEXT NOT NULL DEFAULT '',
      added_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS pipeline_meta (
      id INTEGER PRIMARY KEY DEFAULT 1,
      weekly_target INTEGER NOT NULL DEFAULT 5,
      total_emails_sent INTEGER NOT NULL DEFAULT 0,
      total_replies INTEGER NOT NULL DEFAULT 0,
      last_run TEXT
    );

    CREATE TABLE IF NOT EXISTS reddit_posts (
      id TEXT PRIMARY KEY,
      reddit_id TEXT NOT NULL UNIQUE,
      subreddit TEXT NOT NULL,
      title TEXT NOT NULL,
      url TEXT NOT NULL,
      author TEXT NOT NULL,
      score INTEGER NOT NULL DEFAULT 0,
      body TEXT NOT NULL DEFAULT '',
      keyword_id TEXT REFERENCES keywords(id) ON DELETE SET NULL,
      reply_suggestion TEXT,
      fetched_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS blog_posts (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      slug TEXT NOT NULL UNIQUE,
      content TEXT NOT NULL,
      keywords TEXT NOT NULL DEFAULT '[]',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS linkedin_posts (
      id TEXT PRIMARY KEY,
      content TEXT NOT NULL,
      keyword_id TEXT REFERENCES keywords(id) ON DELETE SET NULL,
      created_at TEXT NOT NULL
    );

    INSERT OR IGNORE INTO pipeline_meta (id, weekly_target, total_emails_sent, total_replies, last_run)
    VALUES (1, 5, 0, 0, NULL);
  `);
}
