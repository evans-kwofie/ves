# Vesper — Outstanding Work

## Campaigns

- [ ] **Reply detection** — `repliedAt` on leads is never set automatically. Need to poll/webhook for email replies (Resend webhooks or inbound parse) and mark the lead as replied so follow-ups are suppressed.
- [ ] **LinkedIn sending** — channel is selectable but no send implementation exists. Email only works today.
- [ ] **Instagram outreach** — add Instagram as a campaign step channel. Manual queue (AI drafts, user sends via app). Instagram's API blocks cold DMs so copy-paste flow is the only compliant approach. Tone should be casual/punchy, distinct from LinkedIn and email drafts.
- [x] **Results tab** — stats strip (sent, leads contacted, replies, reply rate, skipped), lead coverage table (per-step sent status + replied), activity feed sorted newest first.
- [ ] **Template Creation** - allow teams to create multiple templates for various outreach campaigns.
- [ ] **Import Pipeline Data from multiple sources** - csv is the only channel to import bulk lead data, allow users to import from crm or lead gen tools such as attio, hubsport and the like

## Bugs / Polish

- [ ] Delete old `src/routes/$workspaceId/settings/templates.tsx` — was replaced by `src/routes/$workspaceId/templates.tsx` but not deleted (bash was rejected).
- [ ] Remove all debug `console.log` blocks added for draft generation debugging once confirmed working.
