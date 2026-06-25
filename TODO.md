# Vesper — Outstanding Work

## Templates _(next up)_

User feedback: "Full control over email templates, including branding, design, and personalization."

- [ ] **Template editor** — rich email editor with branding (logo, brand colour), layout blocks (header, body, CTA, footer), and live preview. Not a plain textarea — users want design control.
- [ ] **Personalisation tokens** — `{{firstName}}`, `{{company}}`, `{{ceo}}`, `{{customField}}` inserted from a token picker. Resolved at send time from lead data.
- [ ] **Template library** — org-scoped list of saved templates. Each template has a name, channel (email / linkedin / instagram), subject line (email only), and body. Reusable across campaigns.
- [ ] **A/B testing** — attach two template variants (A / B) to a campaign step. Split leads 50/50 at draft generation. Track open rate and reply rate per variant and surface the winner.

## Campaigns

- [x] **Reply detection** — `repliedAt` on leads is never set automatically. Need to poll/webhook for email replies (Resend webhooks or inbound parse) and mark the lead as replied so follow-ups are suppressed.
- [ ] **LinkedIn sending** — see full spec below.
- [x] **Instagram outreach** — add Instagram as a campaign step channel. Manual queue (AI drafts, user sends via app). Instagram's API blocks cold DMs so copy-paste flow is the only compliant approach. Tone should be casual/punchy, distinct from LinkedIn and email drafts.
- [x] **Results tab** — stats strip (sent, leads contacted, replies, reply rate, skipped), lead coverage table (per-step sent status + replied), activity feed sorted newest first.
- [ ] **Batch sending + scheduling** — user feedback: "send campaigns in batches and schedule them exactly how I want." Per-campaign send window (e.g. Mon–Fri 9am–5pm), daily cap (e.g. 30 emails/day), and a send-at picker per draft so the scheduler respects it.

## Analytics

User feedback: "Clear analytics showing delivery rates, open rates, clicks, replies, bounce rates, and conversion percentages" and "A simple dashboard that helps me identify bottlenecks and opportunities instead of overwhelming me with metrics."

- [ ] **Analytics page** — workspace-level dashboard. Keep it focused: emails sent, open rate, reply rate, bounce rate, conversion rate. One number per metric, trend sparkline, no noise.
- [ ] **Per-campaign analytics** — already partially in Results tab. Extend with open rate (needs tracking pixel or Resend webhook) and click rate.
- [ ] **AI performance suggestions** — surface actionable copy/targeting/deliverability recommendations inline (e.g. "reply rate dropped 40% — subject lines with questions outperform statements for this audience").
- [ ] **Bottleneck callouts** — identify where leads are dropping off in the sequence (step 1 → step 2 drop-off %) and surface it prominently.

## Pipeline / Lead Quality

User feedback: "High-quality lead lists with buyers who have the same intent and are actually relevant to my product."

- [ ] **Intent signals** — surface why a lead is relevant (recent funding, hiring for relevant roles, product launches, Reddit posts). Already partially done via enrichment `fitReason` — make this more visible.
- [ ] **Import from multiple sources** — CSV works today. Add Attio, HubSpot, Apollo imports so users aren't manually building lists.
- [ ] **Lead scoring improvements** — current AI score is one-shot at enrichment. Re-score when new intent signals arrive.

## Bugs / Polish

- [x] Delete old `src/routes/$workspaceId/settings/templates.tsx` — was replaced by `src/routes/$workspaceId/templates.tsx` but not deleted (bash was rejected).
- [x] Remove all debug `console.log` blocks added for draft generation debugging once confirmed working.
- [ ] Fix `danger.tsx` TS errors — wrong button variant `"danger"` (should be `"destructive"`), `showClose` prop should be `showCloseButton`.

---

## LinkedIn Sending — Full Spec

### Approach
Use a **Playwright browser automation** (human-mimicking) as a background worker — not LinkedIn's official API (gated behind partner approval, only works for 1st-degree connections anyway). Partner has a working script that:
- Simulates human behaviour with random intervals between actions
- Avoids LinkedIn bot detection reliably
- Was brittle only due to LinkedIn UI selector changes, not detection

This is the same approach used by Expandi, Dripify, Waalaxy etc.

### Architecture

```
App (TanStack Start)
  → generates LinkedIn drafts (AI, already works)
  → marks them status="queued" in campaign_drafts
  → POST /api/linkedin/run-job triggers background worker

LinkedIn Worker (separate Node process or same server, long-lived)
  → polls DB for queued LinkedIn drafts
  → loads saved browser session (cookies) for the user's LinkedIn account
  → for each lead: opens LinkedIn profile, sends message, random delay (3–7 min)
  → updates draft status to "sent" or "failed" as it goes
  → saves updated session cookies back to disk after run
```

**Must run on a persistent server (VPS) — not serverless.** A 20-lead job with 3–5 min random intervals takes 1–2 hours. Vercel/Netlify edge functions won't work.

### What needs to be built

**1. DB — new `linkedin_sessions` table**
- `id`, `userId`, `orgId`, `cookiesJson` (encrypted), `updatedAt`
- Stores the persisted Playwright browser state so the worker doesn't need to re-login every run

**2. LinkedIn OAuth or manual session setup**
- Simplest: user logs into LinkedIn inside a Playwright-controlled browser once (visible, not headless), session cookies saved
- Alternative: LinkedIn OAuth (gets access token but NOT messaging permissions without partner approval — so still need Playwright for actual sending)
- Recommended: one-time setup flow at `/settings/linkedin` — "Connect LinkedIn" opens a browser window, user logs in, cookies saved

**3. Background worker — `src/workers/linkedin-sender.ts`**
- Integrates partner's existing Playwright script
- Accepts job: `{ drafts: CampaignDraft[], leads: Lead[], sessionCookies: string }`
- Sends one message per lead with random delay
- Returns per-lead result: `{ leadId, status: "sent" | "failed", error? }`
- Serialized per user (one browser per LinkedIn account at a time)

**4. API endpoint — `POST /api/linkedin/run-job`**
- Accepts `{ campaignId, stepNumber? }` — queues LinkedIn drafts for that campaign/step
- Triggers worker in background (`setImmediate` or child process)
- Returns `{ jobId, queued: number }`

**5. Job status tracking**
- Poll `GET /api/linkedin/job-status?campaignId=...` to show progress in UI
- Or use DB draft statuses directly (queued → sent/failed per lead as it processes)

**6. DraftCard — LinkedIn branch**
- No "Approve & Send" button for LinkedIn drafts
- Instead: "Queue for Sending" button (adds to job queue) OR "Open LinkedIn + Copy" fallback if no session configured
- No subject line shown (LinkedIn DMs have no subject)
- No email signature appended (already need to fix in `draft-content.ts` — it currently appends email sig regardless of channel)
- If lead has no `linkedin` URL, show warning

**7. Draft generation fix — `draft-content.ts`**
- Don't append email signature for LinkedIn channel drafts
- Tell AI to stay under 300 chars for step 1 (connection request note limit) and under 2000 for follow-ups
- Already writes LinkedIn-appropriate tone, just needs the char constraint

### Constraints / gotchas
- **One browser per LinkedIn account** — parallel jobs on same account look suspicious, must serialize
- **Session expiry** — LinkedIn sessions last weeks but can expire; if CAPTCHA appears mid-run the job needs to pause and alert the user
- **Selector drift** — LinkedIn's UI changes break Playwright selectors; partner's script needs occasional maintenance
- **Rate limits** — LinkedIn will flag accounts sending 50+ messages/day; recommend capping at 20–30/day with natural spacing
- **Reply detection** — LinkedIn doesn't expose replies via API; `repliedAt` for LinkedIn leads would need a "Mark Replied" button in the UI (manual), or the Playwright script could poll the LinkedIn inbox for replies

### Starting point when resuming
1. Get partner's Playwright script and understand its interface (what args it takes, what it returns)
2. Build the session setup flow at `/settings/linkedin`
3. Wire the worker with the existing draft queue
