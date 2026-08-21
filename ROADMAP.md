# Outreach Platform Roadmap Tracker

Source: [Outreach Platform Roadmap.pdf](./Outreach%20Platform%20Roadmap.pdf)

This is the execution tracker for the product roadmap. Work only moves to **Done** when its definition of done is met in a production-like environment—not when a screen, route, or table merely exists.

## Status legend

- `[x]` Done and verified
- `[-]` In progress
- `[ ]` Not started
- `⚠️` Exists partially; not an end-to-end product capability

## Current product truth

| System | Status | Notes |
|---|---|---|
| Lead intelligence | ⚠️ Partial | Lead import, enrichment, ICP score, and fit reason exist; ranking and validation are not yet proven end to end. |
| Personalization | ⚠️ Partial | Gemini creates email, LinkedIn, and Instagram drafts from org/lead context. Rich business-data ingestion and product-to-prospect matching remain. |
| Outreach automation | ⚠️ Partial | Multi-step draft scheduling and email sending exist. Only Resend email is a complete coded transport. |
| Deliverability | ⚠️ Partial | Send caps/windows and Resend bounce/open/click events exist; verification, warmup, rotation, and health are not built. |
| Outreach intelligence | ⚠️ Partial | Basic analytics and insight UI exist; no validated recommendations/learning loop. |

## Active milestone — Instagram discovery and outreach

- [x] **Instagram discovery** — live Serper → Playwright → ingestion run verified token configuration, profile deduplication, and lead creation.
- [x] **Instagram campaign drafts** — channel, templates, and Instagram-specific AI draft rules are available; live AI generation validated.
- [x] **Instagram manual-send workflow** — review queue supports copy, prospect-profile open, and manual sent/replied recording; acceptance flow validated.
- [x] **Instagram campaign lifecycle** — manual sends schedule the next step and appear in analytics; replies record the outcome and suppress queued follow-ups; acceptance flow validated.

**Done when:** a user can discover an Instagram prospect, add and enrich them, generate a compliant DM, send it manually, record the outcome, and see it in campaign analytics.

---

## Milestone 0 — Ship-safe foundation

- [x] Production build passes.
- [x] Campaign drafts are unique per campaign + lead + sequence step.
- [x] Lead enrichment persists verified company, contact name, and email.
- [x] Gemini draft output has schema constraints and retries malformed JSON once.
- [x] Add automated tests for draft generation, multi-step scheduling, sending, reply suppression, and webhooks. Regression coverage now protects channel-safe drafting, scheduling, send state, reply suppression, and signed Resend webhook handling.
- [ ] Add a production-like smoke test for the complete campaign lifecycle.
- [x] Replace runtime schema mutation with versioned, repeatable database migrations. Runtime setup now runs 15 ordered migrations; a freshly recreated local PostgreSQL `vesper` database applied all migrations successfully (27 public tables).
- [x] Document required production environment variables and webhook setup.

**Done when:** a clean deployment migrates safely and an automated smoke test proves the critical campaign flow.

## Milestone 1 — Lead intelligence (MVP)

### Lead data model and imports

- [x] Store company, contact, email, website, LinkedIn URL, source, notes, pipeline stage, score, fit, and fit reason.
- [x] Support direct lead creation and CSV/import-oriented pipeline flows. CSV imports map company, contact, email, website/profile, company context, role, industry, size, location, intent signals, engagement history, notes, and source-row provenance.
- [x] Add normalized fields for role, industry, company size, location, intent signals, engagement history, and enrichment freshness.
- [x] Deduplicate imported/discovered leads by normalized email or website/profile URL. Normalized email, LinkedIn/Instagram/Reddit profile URL, and company-contact identity are protected at creation and email updates; company/domain matching remains deliberately contact-aware.
- [x] Add data-source provenance and last-verified timestamps.

### Discovery and enrichment

- [x] Reddit discovery, classification, reply suggestions, and lead creation.
- [x] LinkedIn-oriented prospect discovery and lead creation.
- [x] Instagram discovery and lead creation.
- [x] Enrichment can find company/profile context and attempt email lookup.
- [-] Persist company, person, website/profile, and contact-channel validation with explicit reasons; Hunter-backed email verification evidence now persists, while risky-address suppression remains.
- [x] Retry enrichment up to three attempts with observable pipeline stages and failure history. Every newly created lead now enters the shared background enrichment queue automatically.
- [ ] Surface recent public activity, announcements, and relevant business events where permitted.

### ICP filtering and scoring

- [x] Store an AI score (0–100), fit rating, and fit reason.
- [x] Define a transparent scoring rubric for role, company, industry, region, size, and intent signals. The visible breakdown weights company context, contact channel, intent, role, industry, size, location, and enrichment evidence.
- [x] Rank leads by fit then score by default and expose fit filters in the pipeline.
- [x] Re-score leads when new enrichment or intent signals arrive.
- [x] Show fit/score and the AI fit reason in the pipeline, with dedicated highest-fit, stale, and verification-needed priority queues.

**Done when:** a user can import or discover leads, enrich them, understand why each one fits, and reliably start campaigns with the highest-priority segment.

## Milestone 2 — Campaign and sequence engine (MVP)

- [x] Create campaigns and attach leads.
- [x] Configure ordered multi-step sequences with delays and channel metadata.
- [x] Generate first messages and follow-up drafts.
- [x] Schedule the next step after a send.
- [x] Suppress next steps once an email reply is recorded.
- [x] Support review, approval, skipping, and manual sent marking.
- [x] Add campaign-level batch size, exact schedule, timezone, and per-channel send rules. Campaigns enforce an exact start timestamp, timezone-aware windows, batch caps, and channel-specific daily-cap/weekday overrides for email, LinkedIn, and Instagram.
- [x] Make queue states explicit: draft → approved → queued → sending → sent/failed/skipped. Email review now persists approval as a separate state before any send; scheduled, sending, sent, failed, and skipped states remain explicit.
- [x] Add idempotency and recovery for interrupted scheduler work. Due drafts are atomically claimed before generation, released after recoverable errors, and stale generation claims are recovered on the next scheduler run.
- [x] Add campaign pause/resume and lead-level opt-out controls.
- [x] Add unsubscribe handling for email where legally required.

**Done when:** a campaign can run from selected leads through every configured step without overwriting drafts, duplicating sends, or following up after a reply/opt-out.

## Milestone 3 — Business and prospect intelligence (MVP)

- [x] Use organization metadata and lead context in personalization prompts.
- [x] Ingest customer website, product information, sales documents, PDFs, ICP, existing messaging, internal documents, and brand-voice examples. Onboarding reads a public pricing page; workspace settings now import pasted materials, text documents, and PDFs with traceable source records.
- [x] Extract products, benefits, problems solved, ideal customers, voice, terminology, and positioning into a structured profile. Pricing-page offers and source-backed business-material extraction both feed drafting context.
- [x] Research permitted prospect/company information: role, company context, public activity, website, and relevant events. Enrichment stores recent public signals with source URLs and shows them in lead details.
- [x] Implement product-to-prospect matching: choose the most relevant product or feature before writing. A deterministic match uses profile, intent, role, and recent public context; its evidence is included in draft context.
- [x] Show the evidence/context used for a generated message so users can review it.

**Done when:** every message can explain which customer product/benefit it selected and which verified prospect context made it relevant.

## Milestone 4 — AI personalization and content quality (MVP)

- [x] Generate channel-aware email, LinkedIn, and Instagram drafts with follow-up guidance.
- [x] Store reusable templates for email, LinkedIn, and Instagram.
- [x] Decide and document the primary model/provider strategy (the roadmap names Claude; current implementation uses Gemini). Gemini 2.5 Flash is the current structured-generation provider; see `docs/ai-model-strategy.md`.
- [x] Add brand-voice controls, reusable writing rules, and customer terminology.
- [x] Add content checks: generic openings, length, CTA clarity, prospect relevance, readability, and spam-risk language. Review flags generic openings, channel limits, CTA, spam-risk terms, missing prospect context, long sentences, dense wording, and unscannable long blocks.
- [x] Add personalized follow-ups that reference prior outreach without repetition. Scheduled steps preserve the sent draft, then include it as protected context when generating the follow-up.
- [x] Add template A/B tests with assignment, open/reply measurement, and a clear winner. Variants are split evenly, results appear in campaign and workspace analytics, and replies are attributed to each lead's first tested exposure.

**Done when:** messages are grounded in real context, meet channel constraints, pass quality checks, and can be improved using measured results.

## Milestone 5 — Email sending, replies, and basic tracking (MVP)

- [x] Resend email transport.
- [x] Store provider message IDs when campaign drafts are sent.
- [x] Receive inbound replies through a tagged reply address and stop the lead sequence.
- [x] Verify Resend webhook signatures and record opens, clicks, bounces, and complaints when supplied.
- [x] Enforce basic daily caps, business-hour windows, and weekday-only settings.
- [ ] Validate the full Resend inbound/domain/webhook configuration in a production-like environment.
- [ ] Add delivered, positive-reply, meeting, unsubscribe, and conversion event handling.
- [-] Add reliable email verification before sending. Hunter verification evidence persists, existing addresses are verified on send when available, invalid/disposable results block direct and campaign sends, and catch-all domains require explicit confirmation; provider-unavailable fallback remains.
- [-] Add an audit trail for every provider request and webhook outcome. Resend email send attempts and verified outbound-event webhooks are recorded; remaining providers/actions remain.

**Done when:** an email can be sent, delivered/bounced/replied-to, attributed to a campaign step, and reflected accurately in the lead and campaign state.

## Milestone 6 — Analytics and recommendations (MVP)

- [x] Store and display baseline sent, reply, bounce, open, click, and channel metrics where data exists.
- [x] Show campaign results and basic insight UI.
- [-] Verify every metric against provider events and define reliable denominators. The code audit now uses Resend delivery events as the open/click denominator, campaign-attributed outcome events for reply rates, and includes all supported manual channels in contact totals; live-provider reconciliation remains.
- [x] Track positive replies, meetings, conversions, unsubscribes, and per-step performance. Campaign outcomes are captured, and each reply is attributed to the last eligible sent step rather than every prior touch.
- [x] Surface bottlenecks: opens without replies, poor CTAs, weak opening lines, and drop-offs between steps. Insights now flag high opens with weak replies and underperforming second steps using workspace data.
- [-] Add actionable recommendations tied to evidence, not generic AI advice. Analytics suggestions now cite the workspace's observed counts/rates and propose a specific next test; recommendation coverage remains incomplete.
- [ ] Add experiment history and cross-campaign learning only after metric quality is trusted.

**Done when:** users can see what happened, why a campaign underperformed, and what specific change to test next.

## Milestone 7 — Deliverability (Phase 2)

- [x] Domain setup guidance for SPF, DKIM, and DMARC. Production setup documentation now covers verified sending subdomains, SPF/DKIM/DMARC rollout, webhooks, caps, and sender-health checks.
- [ ] Email verification and risky-address suppression.
- [ ] Sender health monitoring: bounces, complaints/spam signals, volume, reply behavior, domain health, inbox health.
- [ ] Automated warmup.
- [ ] Multiple sender accounts and inbox rotation.
- [ ] Deliverability testing before high-volume sends.
- [ ] Automated spam recovery: detect degradation, reduce/pause traffic, select healthy senders, alert users, and monitor recovery.

**Done when:** the platform can protect sending reputation proactively and explain any automatic action it takes.

## Milestone 8 — Multichannel outreach (Phase 3)

### LinkedIn

- [x] OAuth connection and organic post publishing.
- [x] Generate LinkedIn DM and connection-note drafts.
- [ ] Implement a compliant/manual LinkedIn sending workflow, or secure approved API/partner access before automating messaging.
- [ ] Track manual sends/replies and suppress subsequent steps.
- [ ] Integrate LinkedIn actions into a unified campaign timeline.

### Instagram

- [-] Discovery and manual-outreach workflow (active milestone above).
- [ ] Unified timeline and metrics.

### Reddit

- [x] Discover relevant posts and prepare reply suggestions.
- [ ] Add compliant manual publishing/reply tracking.
- [ ] Attribute conversations and outcomes to leads/campaigns.

### Sequence orchestration

- [ ] Run email, LinkedIn, Instagram, Reddit, phone, and later channels in one workflow where integrations permit.
- [x] Show one prospect timeline across all channels. Lead details now show chronological sends and outcomes with channel and campaign context.
- [ ] Add behavior-based triggers and channel-specific fallback logic.
- [ ] Build a unified inbox for all connected sending accounts and supported channels.

**Done when:** a user can coordinate supported channels in one sequence and understand every prospect interaction in one place.

## Milestone 9 — Dynamic media personalization (Phase 3)

- [ ] Personalized images.
- [ ] Dynamic screenshots.
- [ ] Personalized video thumbnails.
- [ ] Personalized landing pages.
- [ ] Use the same prospect intelligence layer to select relevant media/content.
- [ ] Measure media impact separately from copy impact.

## Milestone 10 — Advanced data platform (Phase 3+)

- [ ] Define legal, licensed, and permitted data sources.
- [ ] Build collection, normalization, deduplication, verification, enrichment, storage, search, refresh, company matching, and person matching pipelines.
- [ ] Track data freshness and confidence.
- [ ] Scale toward a proprietary lead database only after data quality and compliance are proven.
- [ ] Combine database filtering, enrichment, prospect intelligence, and AI scoring into ranked target segments.

## Milestone 11 — Advanced intelligence and infrastructure (Phase 4)

- [ ] Cross-campaign learning and message optimization based on historical results.
- [ ] Prospect-specific product/feature recommendations.
- [ ] Automated sender-health management and traffic routing.
- [ ] Large-scale sender/agency infrastructure.
- [ ] Advanced reputation monitoring and automated spam recovery.

## Future integrations

- [ ] Gmail and Google Workspace.
- [ ] Google Sheets import/sync.
- [ ] External SMTP routing.
- [ ] Salesforce.
- [ ] HubSpot.
- [ ] Zapier.
- [ ] Public REST API.
- [ ] Chrome extension for supported prospecting workflows.

## Competitive capability checklist

These are roadmap learnings, not a commitment to integrate the named competitor products directly.

- [ ] GMass-inspired: Gmail/Workspace and Sheets workflows; spam testing; external SMTP.
- [ ] Apollo-inspired: large-scale B2B search/filtering, buyer intent, enrichment, CRM links, Chrome extension.
- [ ] Saleshandy-inspired: content scoring, spam-word/readability checks, sender rotation, email verification.
- [ ] Instantly-inspired: context-aware copy, unified inbox, sender infrastructure, company knowledge base.
- [ ] PlusVibe-inspired: deliverability onboarding, domain detection, warmup, engagement simulation.
- [ ] Lemlist-inspired: personalized media and multichannel sequences.
- [ ] Smartlead-inspired: sender infrastructure, agency controls, spam recovery, custom AI integrations.

## Product flow acceptance test

The MVP is ready only when this flow passes for a real test organization:

1. [-] Capture customer business data, ICP, products, and voice. Website and pricing-page product capture is available; ICP and document ingestion remain.
2. [ ] Discover or import prospects.
3. [ ] Enrich, validate, and score prospects.
4. [ ] Select a ranked segment and create a campaign.
5. [ ] Generate context-grounded first messages and follow-ups.
6. [ ] Send through an approved channel with safeguards.
7. [ ] Detect replies/bounces and prevent inappropriate follow-ups.
8. [ ] Measure campaign and step performance.
9. [ ] Produce one evidence-backed improvement suggestion.
10. [ ] Run the improved follow-up or next campaign and retain the learning.

## Execution order

1. Finish Instagram discovery/manual-outreach milestone.
2. Add critical-flow tests and a production-like email smoke test.
3. Finish lead validation, ranking, and visible ICP evidence.
4. Finish business/prospect intelligence ingestion and product matching.
5. Verify campaign email lifecycle and metric attribution.
6. Complete analytics/recommendation loop.
7. Build deliverability protections before increasing send volume.
8. Add further channels and only then advanced data/infrastructure.
