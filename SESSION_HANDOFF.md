# Lead Intelligence Handoff

Read [ROADMAP.md](./ROADMAP.md) first. It is the authoritative product tracker based on `Outreach Platform Roadmap.pdf`.

## Scope agreed in this session

The user asked to finish the remaining **Lead Intelligence** roadmap work, specifically including durable/background enrichment, then normalized lead data, provenance/freshness, robust deduplication, transparent scoring/re-scoring, and verification. This does **not** authorize completion of the unrelated campaign, deliverability, analytics, or multichannel milestones.

## User-facing lead work completed before the handoff

- Leads can be created without a contact name or email; enrichment may fill them in later.
- Duplicate checks exist for normalized email, Instagram profile URL, and company + contact name.
- Lead editing supports company, contact, email, website/profile, LinkedIn, description, status, and notes.
- The lead table shows `No contact person` and `No email` for missing data.
- The actions menu only offers supported actions: details, email/copy email only when present, open website/LinkedIn only when present, enrich, and edit.
- Lead details are in `src/components/modules/pipeline/molecules/LeadDetailsSheet.tsx`; outreach history was intentionally removed from the edit modal.
- Edit dialog width: `sm:min-w-2xl`. Details sheet also uses the requested `sm:min-w-*` convention.
- `.form-group` labels now have a 6px input gap in `src/styles/app.css`.
- Enrichment stages include `enriching`, `enriched`, `validated`, and `enrichment_failed`. After 3 exhausted attempts, the UI says “enrichment failed”, not generic “failed”.
- Invalid lead-update requests now log tagged field-level validation errors without logging submitted values, and the edit toast shows the first validation error.

## Background enrichment work started in the last interrupted session

These changes are uncommitted and need review/completion:

- `src/db/schema.ts` creates `lead_enrichment_jobs` and `lead_enrichment_attempts`, including due-job and history indexes.
- `src/db/queries/leads.ts` adds job/attempt types and helpers:
  - `queueLeadEnrichment`
  - `getDueEnrichmentJobs`
  - `updateEnrichmentJob`
  - `createEnrichmentAttempt`
  - `getEnrichmentAttempts`
- `src/lib/enrichment-scheduler.ts` was added. It runs every 30s, processes queued jobs, retries after 1 and 5 minutes, writes attempt history, and eventually sets `enrichment_failed`.
- `src/middleware/db.ts` starts this scheduler after database initialization.
- `POST /api/pipeline/enrich` now queues lead jobs and returns `{ ok, queued, total }`; the action menu reports that enrichment continues in the background.

## Important follow-up before treating background enrichment as done

1. `src/routes/api/pipeline/enrich.ts` still contains the old synchronous implementation inside a block comment after the early queued response. Delete that obsolete code and clean up unused imports (`auth`, `updateLead`, `findEmail`, `splitName`) once the worker path is verified.
2. Do not import helpers from a route module long term. `src/lib/enrichment-scheduler.ts` currently imports enrichment helpers from `src/routes/api/pipeline/enrich.ts` as a quick extraction seam. Move shared enrichment/validation logic into a new neutral module, e.g. `src/lib/lead-enrichment.ts`, then import it from both route and scheduler.
3. Make job claiming crash-safe and multi-instance safe. Current in-process `running` guard only protects one server process. Use a conditional DB claim/lease and reclaim stale `running` jobs.
4. Surface `getEnrichmentAttempts(leadId)` in `GET /api/pipeline/leads/$id?include=events` and show the result in `LeadDetailsSheet`. The user explicitly expects the separate sheet to show all lead history.
5. Add automatic client refresh/polling or a visible queued state until the worker completes. The current UI refreshes once immediately after queueing and therefore shows `enriching` until the page is refreshed.
6. Write a regression/smoke test for queue → retry → valid/failed terminal state. No lead enrichment tests currently exist.

## Instagram discovery work (this session)

Discussed the `instagramoutreach.pdf` doc the user was handed. Scope agreed: build **discovery + enrichment only**. The outreach/DM-automation and ban-risk angle from the doc is explicitly deferred — the user is discussing that separately with whoever shared the doc, and it is **not** authorized work here.

Decisions made:
- Standalone Python scraper (Scrapy + Playwright), not folded into the TanStack app. It pushes results into ves over HTTP rather than touching Postgres directly.
- Google discovery step uses Serper (a proper Search API), not browser automation against google.com, to avoid fragile/blockable scraping of Google itself.
- Built as an end-to-end MVP: query construction → Serper search → post→profile resolution via Playwright → profile extraction → follower-count filter → POST to ves.

### ves side (committed to this repo)

- `src/routes/api/discover/instagram/add.ts` — new ingestion endpoint, modeled on the existing `src/routes/api/directories/add.ts` pattern.
  - Auth: static bearer token compared against `process.env.INSTAGRAM_SCRAPER_TOKEN` (same convention as `INBOUND_WEBHOOK_SECRET`/`RESEND_WEBHOOK_SECRET` in `src/routes/api/webhooks/*`). Returns 500 if the env var is unset, 401 on mismatch.
  - Body: `{ organizationId, profiles: [{ profileUrl, username, displayName?, bio?, followers?, linkInBio?, sourcePostUrl?, queryUsed? }] }`, zod-validated, up to 500 profiles per call.
  - Maps each profile to `createLead(orgId, { company, ceo, website: profileUrl, whatTheyDo: bio, fit: "MEDIUM", notes: [...], source: "instagram" })`.
  - **Note:** this file no longer passes an `email` field or does its own dedupe-by-website check — it was simplified to lean on `createLead`'s own normalized dedup (email/Instagram profile URL/company+contact), which was extended for exactly this in the background-enrichment work described below. Confirm that dedup path still covers "same IG profile URL, no email" before relying on it at scale.
  - Verified end-to-end manually: dev server up, curl POST with a fake profile → row landed in `leads` with correct fields and notes formatting; re-POST of the same profile was skipped (dedup worked); wrong bearer token → 401. Test row was deleted after verification (org used: Mailbridge, `H9xK8M1v1LtOAaInJ1YAmTBEKYsD1W1z`).
- Root `.env` — `INSTAGRAM_SCRAPER_TOKEN` set (generated via `openssl rand -hex 32`).

### Standalone scraper (new, uncommitted — `instagram-discovery/`)

Directory contents: `query_builder.py`, `search_client.py` (Serper), `run.py` (CLI entrypoint), `instagram_discovery/` (Scrapy project: `spiders/instagram.py`, `items.py`, `pipelines.py`, `settings.py`), `requirements.txt`, `scrapy.cfg`, `.env` / `.env.example`, `README.md`.

- `.env` configured: `SERPER_API_KEY` (real key, live), `VES_API_URL=http://localhost:3000`, `VES_ORG_ID` set to Mailbridge's id, `INSTAGRAM_SCRAPER_TOKEN` matching the ves-side value, `MIN_FOLLOWERS=0`, `MAX_FOLLOWERS` unset.
- Python venv created at `instagram-discovery/venv`, `requirements.txt` installed successfully.
- Playwright Chromium **and** the separate headless-shell binary variant were installed (`playwright install chromium` alone was not enough the first time — a follow-up install of the headless-shell binary was required to fix a "Request failed" error seen in a single-URL debug crawl).
- **Not yet confirmed working**: was mid-way through re-running a single-URL debug crawl (`https://www.instagram.com/sista_abenah`) to verify the headless-shell fix when the session was interrupted. No live multi-query run against Serper/Instagram has completed yet.
- Full CLI usage once verified: `python run.py "fitness coaches in Ghana" --max-queries 1 --results-per-query 5` (run from `instagram-discovery/` with the venv activated).

### Next steps for Instagram discovery

1. Finish the single-URL debug crawl to confirm the headless-shell fix actually resolves the "Request failed" error.
2. Run a small real query (1 query, ~5 results) end-to-end against live Instagram/Serper, then confirm the resulting leads appear correctly in the Mailbridge pipeline.
3. Decide whether to commit the `instagram-discovery/` directory (currently untracked) and add `.gitignore` entries for its `venv/` and `.env`.
4. Re-confirm `createLead`'s dedup logic actually treats a bare Instagram profile URL as enough for a duplicate check (no email present) — this route depends on that.
5. This item overlaps with roadmap item "Validate Instagram discovery end to end" below — once 1–2 pass, that roadmap item can move.

## Remaining Lead Intelligence roadmap items

Use the unchecked/partial Milestone 1 items in [ROADMAP.md](./ROADMAP.md) as the source of truth:

1. Finish durable enrichment worker/history/recovery above.
2. Add normalized lead fields: role, industry, company size, location, intent signals, engagement history, data source/provenance, last verified/enriched timestamps.
3. Replace ad-hoc dedupe with normalized email/domain/company/person/social profile matching. Preserve support for several contacts at one company.
4. Add provider-backed email verification and retain verification status/confidence/source.
5. Define a transparent scoring rubric based on role, company, industry, region, size, and intent. Store score breakdown/evidence.
6. Re-score on enrichment and relevant new signals.
7. Add pipeline UI filters/queues for priority, freshness, verification and enrichment state.
8. Validate Instagram discovery end to end.
9. Add a production-like acceptance test: import/discover → enrich → understand fit → select top segment → start campaign.
10. Only then mark Milestone 1 done in `ROADMAP.md`.

## Verification already run

Targeted checks after the queued-worker changes passed:

```sh
pnpm exec tsc --noEmit --pretty false 2>&1 | rg 'enrichment|pipeline/enrich|LeadActionsMenu|LeadTable|db/queries/leads|middleware/db' || true
git diff --check
```

This does **not** prove the worker ran against a live database or external enrichment provider.

## Working tree / safety

The worktree is intentionally dirty and contains changes outside the lead module. Do not reset, checkout, or discard broadly. Review `git status --short` and preserve user work.

## Suggested skills

- `diagnose` for any queue/job failure: build a deterministic DB/HTTP test loop before changing retry logic.
- `tdd` when adding the enrichment queue regression coverage.
- `emil-design-eng` for any pipeline/sheet UI changes.
- `review` before considering the milestone complete.

