import { db } from "./client";

async function safeAlter(query: string) {
  try {
    await db.execute(query);
  } catch {
    // Ignore duplicate column errors (SQLite limitation)
  }
}

export async function initDb(): Promise<void> {
  // Better Auth tables — created here so fresh deploys work without running drizzle-kit manually.
  await db.executeMultiple(`
    CREATE TABLE IF NOT EXISTS \`user\` (
      \`id\` text PRIMARY KEY NOT NULL,
      \`name\` text NOT NULL,
      \`email\` text NOT NULL,
      \`email_verified\` integer NOT NULL,
      \`image\` text,
      \`created_at\` integer NOT NULL,
      \`updated_at\` integer NOT NULL
    );
    CREATE UNIQUE INDEX IF NOT EXISTS \`user_email_unique\` ON \`user\` (\`email\`);

    CREATE TABLE IF NOT EXISTS \`session\` (
      \`id\` text PRIMARY KEY NOT NULL,
      \`expires_at\` integer NOT NULL,
      \`token\` text NOT NULL,
      \`created_at\` integer NOT NULL,
      \`updated_at\` integer NOT NULL,
      \`ip_address\` text,
      \`user_agent\` text,
      \`user_id\` text NOT NULL,
      \`active_organization_id\` text,
      FOREIGN KEY (\`user_id\`) REFERENCES \`user\`(\`id\`) ON DELETE CASCADE
    );
    CREATE UNIQUE INDEX IF NOT EXISTS \`session_token_unique\` ON \`session\` (\`token\`);

    CREATE TABLE IF NOT EXISTS \`account\` (
      \`id\` text PRIMARY KEY NOT NULL,
      \`account_id\` text NOT NULL,
      \`provider_id\` text NOT NULL,
      \`user_id\` text NOT NULL,
      \`access_token\` text,
      \`refresh_token\` text,
      \`id_token\` text,
      \`access_token_expires_at\` integer,
      \`refresh_token_expires_at\` integer,
      \`scope\` text,
      \`password\` text,
      \`created_at\` integer NOT NULL,
      \`updated_at\` integer NOT NULL,
      FOREIGN KEY (\`user_id\`) REFERENCES \`user\`(\`id\`) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS \`verification\` (
      \`id\` text PRIMARY KEY NOT NULL,
      \`identifier\` text NOT NULL,
      \`value\` text NOT NULL,
      \`expires_at\` integer NOT NULL,
      \`created_at\` integer,
      \`updated_at\` integer
    );

    CREATE TABLE IF NOT EXISTS \`organization\` (
      \`id\` text PRIMARY KEY NOT NULL,
      \`name\` text NOT NULL,
      \`slug\` text,
      \`logo\` text,
      \`created_at\` integer NOT NULL,
      \`metadata\` text
    );
    CREATE UNIQUE INDEX IF NOT EXISTS \`organization_slug_unique\` ON \`organization\` (\`slug\`);

    CREATE TABLE IF NOT EXISTS \`member\` (
      \`id\` text PRIMARY KEY NOT NULL,
      \`organization_id\` text NOT NULL,
      \`user_id\` text NOT NULL,
      \`role\` text NOT NULL,
      \`created_at\` integer NOT NULL,
      FOREIGN KEY (\`organization_id\`) REFERENCES \`organization\`(\`id\`) ON DELETE CASCADE,
      FOREIGN KEY (\`user_id\`) REFERENCES \`user\`(\`id\`) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS \`invitation\` (
      \`id\` text PRIMARY KEY NOT NULL,
      \`organization_id\` text NOT NULL,
      \`email\` text NOT NULL,
      \`role\` text,
      \`status\` text NOT NULL,
      \`expires_at\` integer NOT NULL,
      \`inviter_id\` text NOT NULL,
      FOREIGN KEY (\`organization_id\`) REFERENCES \`organization\`(\`id\`) ON DELETE CASCADE,
      FOREIGN KEY (\`inviter_id\`) REFERENCES \`user\`(\`id\`) ON DELETE CASCADE
    );
  `);

  await db.executeMultiple(`
    PRAGMA foreign_keys = ON;

    -- ========================
    -- ICP / PRODUCT CONTEXT
    -- ========================

    CREATE TABLE IF NOT EXISTS organization_profile (
      id TEXT PRIMARY KEY,
      organization_id TEXT NOT NULL UNIQUE,
      product_description TEXT,
      value_proposition TEXT,
      industry TEXT,
      target_customer TEXT,
      company_size TEXT,
      region TEXT,
      website_url TEXT,
      twitter_url TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    -- ========================
    -- KEYWORDS / DISCOVERY
    -- ========================

    CREATE TABLE IF NOT EXISTS keywords (
      id TEXT PRIMARY KEY,
      organization_id TEXT NOT NULL,
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
      organization_id TEXT NOT NULL,

      company TEXT NOT NULL,
      website TEXT NOT NULL,
      what_they_do TEXT NOT NULL,
      ceo TEXT NOT NULL,

      email TEXT UNIQUE,
      linkedin_url TEXT,
      linkedin_hint TEXT,

      source TEXT,
      keyword_id TEXT REFERENCES keywords(id),

      pipeline_stage TEXT NOT NULL DEFAULT 'discovered',

      enrichment_attempts INTEGER DEFAULT 0,

      is_valid INTEGER,
      validation_errors TEXT DEFAULT '[]',
      website_valid INTEGER,
      person_valid INTEGER,
      company_valid INTEGER,
      validated_at TEXT,

      score INTEGER,
      fit TEXT CHECK(fit IN ('HIGH','MEDIUM','LOW')),
      fit_reason TEXT,

      status TEXT NOT NULL DEFAULT 'not_contacted',
      email_sent_at TEXT,
      linkedin_sent_at TEXT,
      replied_at TEXT,

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
      organization_id TEXT,
      reddit_id TEXT NOT NULL UNIQUE,
      subreddit TEXT NOT NULL,
      title TEXT NOT NULL,
      url TEXT NOT NULL,
      author TEXT NOT NULL,
      score INTEGER NOT NULL DEFAULT 0,
      body TEXT NOT NULL DEFAULT '',
      keyword_id TEXT REFERENCES keywords(id) ON DELETE SET NULL,
      reply_suggestion TEXT,
      intent_type TEXT,
      intent_score INTEGER,
      engagement_type TEXT,
      engagement_score INTEGER,
      comment_count INTEGER,
      has_replies INTEGER,
      last_checked_at TEXT,
      fetched_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS blog_posts (
      id TEXT PRIMARY KEY,
      organization_id TEXT,
      title TEXT NOT NULL,
      slug TEXT NOT NULL UNIQUE,
      content TEXT NOT NULL,
      keywords TEXT NOT NULL DEFAULT '[]',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS linkedin_posts (
      id TEXT PRIMARY KEY,
      organization_id TEXT,
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

  // Safe column additions for existing DBs
  await safeAlter(`ALTER TABLE leads ADD COLUMN organization_id TEXT`);
  await safeAlter(`ALTER TABLE leads ADD COLUMN pipeline_stage TEXT DEFAULT 'discovered'`);
  await safeAlter(`ALTER TABLE leads ADD COLUMN enrichment_attempts INTEGER DEFAULT 0`);
  await safeAlter(`ALTER TABLE leads ADD COLUMN is_valid INTEGER`);
  await safeAlter(`ALTER TABLE leads ADD COLUMN validation_errors TEXT DEFAULT '[]'`);
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
  await safeAlter(`ALTER TABLE reddit_posts ADD COLUMN intent_type TEXT`);
  await safeAlter(`ALTER TABLE reddit_posts ADD COLUMN intent_score INTEGER`);
  await safeAlter(`ALTER TABLE reddit_posts ADD COLUMN engagement_type TEXT`);
  await safeAlter(`ALTER TABLE reddit_posts ADD COLUMN engagement_score INTEGER`);
  await safeAlter(`ALTER TABLE reddit_posts ADD COLUMN comment_count INTEGER`);
  await safeAlter(`ALTER TABLE reddit_posts ADD COLUMN has_replies INTEGER`);
  await safeAlter(`ALTER TABLE reddit_posts ADD COLUMN last_checked_at TEXT`);

  // Campaigns tables
  await db.executeMultiple(`
    CREATE TABLE IF NOT EXISTS campaigns (
      id TEXT PRIMARY KEY,
      organization_id TEXT NOT NULL,
      name TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'draft',
      channel TEXT,
      goal TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS campaign_leads (
      id TEXT PRIMARY KEY,
      campaign_id TEXT NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
      lead_id TEXT NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
      UNIQUE(campaign_id, lead_id)
    );
  `);

  await safeAlter(`ALTER TABLE outreach_events ADD COLUMN campaign_id TEXT REFERENCES campaigns(id) ON DELETE SET NULL`);
  await safeAlter(`ALTER TABLE campaigns ADD COLUMN run_frequency TEXT`);
  await safeAlter(`ALTER TABLE campaigns ADD COLUMN last_run_at TEXT`);

  await db.executeMultiple(`
    CREATE INDEX IF NOT EXISTS idx_campaigns_org ON campaigns(organization_id);
    CREATE INDEX IF NOT EXISTS idx_campaign_leads_campaign ON campaign_leads(campaign_id);
    CREATE INDEX IF NOT EXISTS idx_campaign_leads_lead ON campaign_leads(lead_id);
  `);

  await db.executeMultiple(`
    CREATE INDEX IF NOT EXISTS idx_leads_org ON leads(organization_id);
    CREATE INDEX IF NOT EXISTS idx_leads_pipeline_stage ON leads(pipeline_stage);
    CREATE INDEX IF NOT EXISTS idx_leads_score ON leads(score);
    CREATE INDEX IF NOT EXISTS idx_leads_keyword_id ON leads(keyword_id);
    CREATE INDEX IF NOT EXISTS idx_keywords_org ON keywords(organization_id);
    CREATE INDEX IF NOT EXISTS idx_outreach_lead_id ON outreach_events(lead_id);
    CREATE INDEX IF NOT EXISTS idx_org_profile_org ON organization_profile(organization_id);
  `);
}
