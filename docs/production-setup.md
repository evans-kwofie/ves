# Production setup

Set these server-side environment variables before deploying:

| Variable | Required | Purpose |
| --- | --- | --- |
| `DATABASE_URL` | Yes | PostgreSQL connection string. |
| `BETTER_AUTH_SECRET` | Yes | Session and authentication signing secret. |
| `BETTER_AUTH_URL` | Yes | Public application URL. |
| `RESEND_API_KEY` | For email | Resend API key used to send campaign email. |
| `EMAIL_FROM` | For email | Verified sender, e.g. `Acme <outreach@acme.com>`. |
| `RESEND_WEBHOOK_SECRET` | For email tracking | Svix signing secret for Resend webhooks. |
| `INBOUND_WEBHOOK_SECRET` | For inbound replies | Shared secret for the inbound reply endpoint. |
| `INSTAGRAM_SCRAPER_TOKEN` | For Instagram discovery | Bearer token accepted by the Instagram ingestion endpoint. |
| `SLACK_WEBHOOK_URL` | Optional | Slack notification destination. |
| `GEMINI_API_KEY` | For AI drafting/enrichment | Gemini API credential. |

## Resend

1. Verify the domain used by `EMAIL_FROM` in Resend.
2. Add `POST https://<app-host>/api/webhooks/resend` as a Resend webhook endpoint.
3. Subscribe to `email.opened`, `email.clicked`, `email.bounced`, and `email.complained`.
4. Put the endpoint's Svix signing secret in `RESEND_WEBHOOK_SECRET`.
5. Configure the tagged reply address/inbound provider to call the inbound reply endpoint using `INBOUND_WEBHOOK_SECRET`.

Never expose these values in browser-side environment variables or commit them to source control.

## Deliverability onboarding

Before increasing volume, use a dedicated sending subdomain (for example,
`outreach.example.com`) and complete these checks in the domain's DNS and
Resend dashboard:

1. Publish the SPF record Resend supplies. Keep one SPF record per domain; merge
   authorised senders rather than creating multiple records.
2. Publish Resend's DKIM records and wait for Resend to report the domain as
   verified.
3. Publish a DMARC record, beginning with `p=none` while monitoring alignment,
   then move to `quarantine` or `reject` only after legitimate traffic passes.
4. Set `EMAIL_FROM` to the verified domain and configure `INBOUND_EMAIL_DOMAIN`
   for the tagged reply address. Subscribe the outbound webhook to
   `email.delivered`, `email.opened`, `email.clicked`, `email.bounced`, and
   `email.complained`.
5. Start with a small, verified segment. Keep campaign and channel caps low;
   increase only when delivered, bounce, complaint, and reply metrics remain
   healthy. The app blocks invalid addresses and records provider events, but it
   does not perform automated warmup or sender rotation.
