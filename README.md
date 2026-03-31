# Vesper System & Workflow Blueprint

Vesper is a B2B sales intelligence platform. It discovers leads from Reddit and LinkedIn, enriches and scores them against your ICP, and runs an AI outreach agent that sounds like you.

---

## Architecture

- **Framework**: TanStack Start (React SSR, file-based routing)
- **Database**: LibSQL/Turso (raw SQL, no ORM)
- **Auth**: Better Auth with organization/workspace support
- **AI**: Anthropic Claude — Haiku for classification, Sonnet for enrichment/generation/agent
- **Icons**: HugeIcons (`hugeicons-react`) — duotone only
- **Styling**: Tailwind CSS — no inline `style={}` objects

---

## Multi-Tenant Structure

Every piece of data belongs to a **workspace (organization)**. All queries are scoped by `organization_id`. Users can belong to multiple orgs with roles: `owner`, `admin`, `member`.

---

## Features & Status

### ✅ Onboarding
- Sign up → create workspace → ICP context (industry, target customer, company size, website)
- Select focus areas (up to 3): lead gen, content marketing, outreach automation, etc.
- AI generates a business description from name + website + industry

### ✅ Dashboard
- Greeting with user name + time of day
- Stat cards: total leads, active keywords, Reddit signals, conversion rate — with SVG sparklines
- Lead growth chart (7-day SVG)
- Live activity feed (recent Reddit signals)
- Recent leads table

### ✅ Keywords
- Add/edit/delete keywords with subreddits
- AI keyword generation (Claude Sonnet, web_search) — suggests 10 keywords + relevant subreddits from org context
- Toggle active/inactive

### ✅ Reddit Agent
- Fetch posts from subreddits by keyword
- Claude Haiku classifies intent: `buying`, `pain`, `discussion`, `noise`
- Auto-creates leads for posts with `intent_type=buying` or `intent_score >= 70`
- Reply suggestions per post

### ✅ LinkedIn Agent
- Search for leads (founders/CEOs) by keyword using Claude Sonnet + web_search
- Auto-saves leads with `source=linkedin`
- LinkedIn post generator with keyword + angle inputs

### ✅ Pipeline
- Stages: `discovered → enriching → enriched → validated → failed`
- Lead table with fit badge, score, stage, status
- Add lead manually
- Enrich N leads button → Claude Sonnet enriches + ICP scores in one call
- Fields: `fit` (HIGH/MEDIUM/LOW), `score` (0–100), `fitReason`

### ✅ Lead Enrichment & ICP Scoring
- Runs via `/api/pipeline/enrich`
- Claude Sonnet with web_search enriches missing fields and scores against org context
- Returns `fit`, `score`, `fitReason`

### ✅ Outreach Tracking
- `outreach_events` table: channel (email/linkedin/reply/deal), status, timestamps
- Auto-written when lead status changes to `email_sent`, `linkedin_sent`, `replied`, `converted`
- Timeline shown in lead edit dialog

### ✅ Blog Generation
- Generate AI blog posts from keyword + optional angle
- Save, list, view (markdown rendered), copy markdown
- Delete posts

### ✅ AI Agent
- Custom prompt or daily automated sequence
- Daily run: read pipeline → follow-up on 3-day-old emails → send to not_contacted leads → find new leads if < 20 → Slack summary
- Output log with tool call visibility
- `orgId` threaded through so agent operates on the correct workspace

### ✅ Agent Voice (Settings)
- **Sender identity**: name, title, company name, URL — injected into every email signature
- **Tone & style**: pick one of Direct / Warm / Formal / Casual / Bold / Concise + phrases to never use
- **Email template**: editable cold-email structure with `[bracket]` placeholders
- **Mission**: free text — who to target, what success looks like, who to prioritise
- Stored in org metadata under `agentVoice`, loaded into `buildSystemPrompt()` at run time

### ✅ Workspace Settings
- Workspace name, slug, logo
- Business context: website, industry, team size, description (AI-generatable), focus areas
- Profile settings
- Billing (placeholder)
- Danger zone

---

## ✅ Campaigns

Named outreach sequences targeting a group of leads. DB tables (`campaigns`, `campaign_leads`) built. UI: list view with stats/tabs/cards, create flow (name → leads → review). `outreach_events` has `campaign_id` FK for stat rollup.

### 🔲 Campaign Execution (deferred — full feature planned)

Campaigns are currently containers only — no outreach is fired yet. Full feature to build:

1. **"Run Campaign" button** — triggers AI agent with campaign context (leads, goal, channel, agent voice)
2. **Campaign-aware agent prompt** — agent receives campaign name, goal, channel, lead list; sends outreach and logs `outreach_events` with `campaign_id`
3. **Follow-up logic** — agent detects leads emailed 3+ days ago with no reply and follows up
4. **Campaign scheduler** — `campaigns` gains `scheduled_at`; daily loop auto-runs all active campaigns

Build order when returning: Run button → campaign prompt → event tagging → follow-up logic → scheduler.

---

## Flow

```
Onboarding → ICP + Keywords
     ↓
Lead Discovery
  ├── Reddit Agent (intent classification → auto-lead)
  └── LinkedIn Agent (search → auto-lead)
     ↓
Enrichment + ICP Scoring (Claude Sonnet + web_search)
     ↓
Pipeline (discovered → enriched → validated)
     ↓
Outreach
  ├── Email (manual compose or AI agent)
  ├── LinkedIn DM (manual + agent reminder)
  └── Campaigns (grouped sequences) ← next
     ↓
Outreach Events → Timeline per lead → Campaign stats
     ↓
Feedback loop → re-score, update pipeline
```

---

## Key Files

| Area | Path |
|---|---|
| DB schema + migrations | `src/db/schema.ts` |
| Lead queries | `src/db/queries/leads.ts` |
| Agent entry | `src/agent/agent.ts` |
| Agent system prompt | `src/agent/prompts.ts` |
| Agent voice settings | `src/routes/$workspaceId/settings/agent.tsx` |
| Reddit search + classify | `src/routes/api/reddit/search.ts` |
| LinkedIn search | `src/routes/api/linkedin/search.ts` |
| Enrichment + scoring | `src/routes/api/pipeline/enrich.ts` |
| Outreach events API | `src/routes/api/pipeline/leads.$id.ts` |
| Campaigns page (stub) | `src/routes/$workspaceId/campaigns.tsx` |
