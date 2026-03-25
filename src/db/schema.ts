import { db } from "./client";

async function safeAlter(query: string) {
  try {
    await db.execute(query);
  } catch {
    // Ignore duplicate column errors (SQLite limitation)
  }
}

export async function initDb(): Promise<void> {
  await db.executeMultiple(`
    PRAGMA foreign_keys = ON;

    -- ========================
    -- CORE: USERS + ORGS
    -- ========================

    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      name TEXT,
      avatar_url TEXT,
      current_organization_id TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS organizations (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,

      -- ICP context
      industry TEXT,
      target_customer TEXT,
      company_size TEXT,
      region TEXT,
      website_url TEXT,
      twitter_url TEXT

      -- product context
      product_description TEXT,
      value_proposition TEXT,

      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS memberships (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      role TEXT NOT NULL CHECK(role IN ('owner','admin','member')),
      created_at TEXT NOT NULL,
      UNIQUE(user_id, organization_id)
    );

    -- ========================
    -- KEYWORDS / DISCOVERY
    -- ========================

    CREATE TABLE IF NOT EXISTS keywords (
      id TEXT PRIMARY KEY,
      organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      keyword TEXT NOT NULL,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      UNIQUE(keyword, organization_id)
    );

    CREATE TABLE IF NOT EXISTS subreddits (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      keyword_id TEXT NOT NULL REFERENCES keywords(id) ON DELETE CASCADE,
      created_at TEXT NOT NULL
    );

    -- ========================
    -- LEADS (PIPELINE CORE)
    -- ========================

    CREATE TABLE IF NOT EXISTS leads (
      id TEXT PRIMARY KEY,
      organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

      company TEXT NOT NULL,
      website TEXT NOT NULL,
      what_they_do TEXT NOT NULL,
      ceo TEXT NOT NULL,

      email TEXT UNIQUE,

      linkedin_url TEXT,
      linkedin_hint TEXT,

      source TEXT,
      keyword_id TEXT REFERENCES keywords(id),

      -- PIPELINE
      pipeline_stage TEXT NOT NULL DEFAULT 'discovered',
      -- discovered | enriching | enriched | validated | failed

      enrichment_attempts INTEGER DEFAULT 0,

      -- VALIDATION
      is_valid INTEGER,
      validation_errors TEXT DEFAULT '[]',
      website_valid INTEGER,
      person_valid INTEGER,
      company_valid INTEGER,
      validated_at TEXT,

      -- SCORING
      score INTEGER,
      fit TEXT CHECK(fit IN ('HIGH','MEDIUM','LOW')),
      fit_reason TEXT,

      -- OUTREACH (TEMP)
      status TEXT NOT NULL DEFAULT 'not_contacted',
      email_sent_at TEXT,
      linkedin_sent_at TEXT,
      replied_at TEXT,

      -- META
      notes TEXT NOT NULL DEFAULT '',

      discovered_at TEXT NOT NULL,
      added_at TEXT NOT NULL,
      updated_at TEXT
    );

    -- ========================
    -- OUTREACH EVENTS
    -- ========================

    CREATE TABLE IF NOT EXISTS outreach_events (
      id TEXT PRIMARY KEY,
      lead_id TEXT NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
      channel TEXT,
      status TEXT,
      sent_at TEXT,
      replied_at TEXT
    );

    -- ========================
    -- CONTENT / SIGNALS
    -- ========================

    CREATE TABLE IF NOT EXISTS reddit_posts (
      id TEXT PRIMARY KEY,
      organization_id TEXT REFERENCES organizations(id) ON DELETE CASCADE,
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
      organization_id TEXT REFERENCES organizations(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      slug TEXT NOT NULL UNIQUE,
      content TEXT NOT NULL,
      keywords TEXT NOT NULL DEFAULT '[]',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS linkedin_posts (
      id TEXT PRIMARY KEY,
      organization_id TEXT REFERENCES organizations(id) ON DELETE CASCADE,
      content TEXT NOT NULL,
      keyword_id TEXT REFERENCES keywords(id) ON DELETE SET NULL,
      created_at TEXT NOT NULL
    );

    -- ========================
    -- PIPELINE META
    -- ========================

    CREATE TABLE IF NOT EXISTS pipeline_meta (
      id INTEGER PRIMARY KEY DEFAULT 1,
      weekly_target INTEGER NOT NULL DEFAULT 5,
      total_emails_sent INTEGER NOT NULL DEFAULT 0,
      total_replies INTEGER NOT NULL DEFAULT 0,
      last_run TEXT
    );

    INSERT OR IGNORE INTO pipeline_meta (id, weekly_target, total_emails_sent, total_replies, last_run)
    VALUES (1, 5, 0, 0, NULL);
  `);

  await safeAlter(`ALTER TABLE users ADD COLUMN current_organization_id TEXT`);
  await safeAlter(`ALTER TABLE leads ADD COLUMN organization_id TEXT`);
  await safeAlter(
    `ALTER TABLE leads ADD COLUMN pipeline_stage TEXT DEFAULT 'discovered'`,
  );
  await safeAlter(
    `ALTER TABLE leads ADD COLUMN enrichment_attempts INTEGER DEFAULT 0`,
  );
  await safeAlter(`ALTER TABLE leads ADD COLUMN is_valid INTEGER`);
  await safeAlter(
    `ALTER TABLE leads ADD COLUMN validation_errors TEXT DEFAULT '[]'`,
  );
  await safeAlter(`ALTER TABLE leads ADD COLUMN website_valid INTEGER`);
  await safeAlter(`ALTER TABLE leads ADD COLUMN person_valid INTEGER`);
  await safeAlter(`ALTER TABLE leads ADD COLUMN company_valid INTEGER`);
  await safeAlter(`ALTER TABLE leads ADD COLUMN validated_at TEXT`);
  await safeAlter(`ALTER TABLE leads ADD COLUMN score INTEGER`);
  await safeAlter(`ALTER TABLE leads ADD COLUMN fit_reason TEXT`);
  await safeAlter(`ALTER TABLE leads ADD COLUMN source TEXT`);
  await safeAlter(`ALTER TABLE leads ADD COLUMN keyword_id TEXT`);
  await safeAlter(`ALTER TABLE leads ADD COLUMN linkedin_url TEXT`);
  await safeAlter(`ALTER TABLE leads ADD COLUMN linkedin_hint TEXT`);
  await safeAlter(`ALTER TABLE leads ADD COLUMN updated_at TEXT`);
  await safeAlter(`ALTER TABLE leads ADD COLUMN discovered_at TEXT`);

  await db.executeMultiple(`
    CREATE INDEX IF NOT EXISTS idx_leads_org ON leads(organization_id);
    CREATE INDEX IF NOT EXISTS idx_leads_pipeline_stage ON leads(pipeline_stage);
    CREATE INDEX IF NOT EXISTS idx_leads_score ON leads(score);
    CREATE INDEX IF NOT EXISTS idx_leads_keyword_id ON leads(keyword_id);

    CREATE INDEX IF NOT EXISTS idx_keywords_org ON keywords(organization_id);

    CREATE INDEX IF NOT EXISTS idx_outreach_lead_id ON outreach_events(lead_id);

    CREATE INDEX IF NOT EXISTS idx_memberships_user ON memberships(user_id);
    CREATE INDEX IF NOT EXISTS idx_memberships_org ON memberships(organization_id);
  `);
}
