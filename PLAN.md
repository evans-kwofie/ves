# Vesper — Build Plan

## Schema status: ✅ Complete
All tables exist and initialise correctly on boot:
`keywords`, `subreddits`, `leads`, `reddit_posts`, `blog_posts`, `linkedin_posts`,
`outreach_events`, `organization_profile`, `pipeline_meta`, plus all Better Auth tables.

---

## What's built so far

| Area | Status |
|---|---|
| Auth (sign in / sign up / org) | ✅ Done |
| Onboarding (5-step) | ✅ Done |
| Routing ($workspaceId layout) | ✅ Done |
| Sidebar + workspace selector | ✅ Done |
| Settings (profile / workspace / billing / danger) | ✅ Done |
| Keywords page + CRUD | ✅ Done |
| Reddit page + feed UI | ✅ Shell only |
| Pipeline page + lead table | ✅ Shell only |
| Blog page | ✅ Shell only |
| LinkedIn page | ✅ Shell only |
| AI Agent console | ✅ Shell only |
| Dashboard stats | ✅ Wired but not org-scoped |

---

## Priority 1 — Multi-tenancy ✅ DONE

- [x] Add `orgId: string` param to all list/create/count functions
- [x] Add `WHERE organization_id = ?` to all SELECT queries
- [x] Set `organization_id` on all INSERT statements
- [x] Route loaders extract `workspaceId` from params and pass it down via `createServerFn`
- [x] `pipeline_meta` — `getPipeline` now derives counters live from org-scoped leads; global row is unused

---

## Priority 2 — Reddit Agent ✅ DONE

- [x] Server fn: fetch posts from Reddit API for each subreddit tied to a keyword
- [x] AI step: classify each post intent → `buying | pain | discussion | noise`
- [x] AI step: score engagement → `engagement_type` + `engagement_score`
- [x] AI step: generate reply suggestion per post
- [x] Auto-create a lead when `intent_type = buying` or `intent_score >= 70`
- [x] Wire "Fetch" button in `RedditFeed` to the above
- [x] Store `intent_type`, `intent_score`, `engagement_type`, `engagement_score`, `reply_suggestion` on `reddit_posts`

---

## Priority 3 — LinkedIn Agent

The page is 54 lines and does nothing.

Tasks:
- [ ] Search LinkedIn for founders/CEOs using workspace keywords (via Apify or similar scraping API)
- [ ] Extract: company name, CEO name, LinkedIn URL, website, one-line description
- [ ] Create leads with `source = "linkedin"`, `pipeline_stage = "discovered"`
- [ ] Show discovered LinkedIn leads in a card grid on the LinkedIn page
- [ ] "Run search" button that triggers the agent for each active keyword

---

## Priority 4 — Lead Enrichment Pipeline

The `pipeline_stage` field and `enrichment_attempts` counter exist but nothing ever moves a lead through stages.

Stages: `discovered → enriching → enriched → validated → failed`

Tasks:
- [ ] Enrichment worker: for each `pipeline_stage = discovered` lead, attempt to find missing email, LinkedIn URL, and company details (via Hunter.io / Apollo / Clearbit)
- [ ] Move lead to `enriching` while in-flight, `enriched` on success, `failed` after 3 attempts
- [ ] Validation worker: check `email_valid`, `company_valid`, `person_valid`; set `is_valid` and `validation_errors`
- [ ] Move lead to `validated` on pass, `failed` on hard errors
- [ ] Show pipeline stage as a progress indicator in `LeadRow`
- [ ] "Enrich all" button in Pipeline page header

---

## Priority 5 — ICP Scoring

The `score`, `fit`, and `fit_reason` fields exist on leads but are never populated.

Tasks:
- [ ] Read `organization_profile` (or org metadata) for the workspace's ICP context: `industry`, `target_customer`, `company_size`, `region`, `product_description`, `value_proposition`
- [ ] AI scoring step: compare each enriched lead against ICP context, output `score` (0–100), `fit` (HIGH / MEDIUM / LOW), and a one-sentence `fit_reason`
- [ ] Run scoring automatically after enrichment completes
- [ ] Show `fit` badge prominently in `LeadRow` and `PipelineStats`
- [ ] Allow filtering pipeline by fit rating

---

## Priority 6 — Blog Generation

The blog page and `createBlogPost` query exist. AI generation is not wired.

Tasks:
- [ ] Server fn: take a keyword + org ICP context, call Claude to generate a full SEO blog post (title, content, meta description)
- [ ] "Generate post" button opens a dialog: pick keyword, tone, length → triggers generation with streaming output
- [ ] Save generated post to `blog_posts` with `organization_id`
- [ ] Blog list page: show all posts with title, date, keyword tags, word count
- [ ] Blog detail/edit page: markdown editor to review and tweak before publishing

---

## Priority 7 — AI Agent Orchestration

`AgentConsole` exists but needs to coordinate the full daily run.

Tasks:
- [ ] "Run daily sequence" triggers in order:
  1. Reddit fetch + classify for all active subreddits
  2. LinkedIn search for all active keywords
  3. Enrichment pass on all `discovered` leads
  4. Scoring pass on all `enriched` leads
  5. Summary: new leads found, enriched, scored, failed
- [ ] Stream progress log to `OutputLog` component in real time (via SSE or polling)
- [ ] "Run step" buttons for running each step individually
- [ ] Store last run timestamp and summary in `pipeline_meta`

---

## Priority 8 — Outreach Tracking

The `outreach_events` table exists but nothing writes to it.

Tasks:
- [ ] When a lead status changes to `email_sent` or `linkedin_sent`, create an `outreach_events` row
- [ ] When status changes to `replied`, update the event `replied_at`
- [ ] Show outreach history timeline in a lead detail drawer/modal
- [ ] Add `channel` filter to pipeline table (emailed / not contacted / replied)

---

## Order of execution

```
1. Multi-tenancy fixes          ← nothing else works correctly without this
2. Reddit Agent                 ← highest user-visible value, feeds leads
3. ICP Scoring                  ← needed to make leads useful
4. Lead Enrichment              ← moves leads to ready-to-contact
5. LinkedIn Agent               ← second lead source
6. Blog Generation              ← content channel
7. AI Agent Orchestration       ← ties everything together
8. Outreach Tracking            ← closes the feedback loop
```
