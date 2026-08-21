# Instagram Discovery + Enrichment

Standalone tool. Given a plain-text audience description, finds matching
public Instagram profiles via Google (not Instagram's own search), extracts
profile data, filters by follower count, and pushes results into ves as
leads (`source: "instagram"`). No auto-DM — outreach stays manual/in-app.

Not run as part of the ves app; run it separately, on its own schedule.

## How it works

1. `query_builder.py` — turns the audience description into a few
   `"keyword" site:instagram.com` query variants.
2. `search_client.py` — runs those queries against Serper.dev (Google Search
   API), collects result URLs, filters to `/p/`, `/reel/`, and profile URLs.
3. `instagram_discovery/spiders/instagram.py` — Scrapy + Playwright spider.
   Post/reel URLs get resolved to their owning profile via `og:title`, then
   the profile page is fetched and parsed (mainly `og:description`, which
   Instagram uses for the "N Followers, ... from NAME (@username)" summary).
4. `instagram_discovery/pipelines.py` — drops profiles outside your follower
   range, then batches the rest and POSTs them to
   `POST {VES_API_URL}/api/discover/instagram/add`.

## Setup

```bash
cd instagram-discovery
python3 -m venv venv && source venv/bin/activate
pip install -r requirements.txt
playwright install chromium
cp .env.example .env   # fill in SERPER_API_KEY, VES_ORG_ID, INSTAGRAM_SCRAPER_TOKEN
```

`INSTAGRAM_SCRAPER_TOKEN` must match `INSTAGRAM_SCRAPER_TOKEN` in the ves
app's own `.env` — it's how the app authenticates this script's requests.

## Run

```bash
python run.py "fitness coaches in Ghana targeting weight loss clients"
```

Optional flags: `--max-queries` (default 4), `--results-per-query` (default 20).

## Known fragility

Instagram's markup changes without notice, and profile pages beyond basic
`og:description` stats are increasingly gated behind login. Treat scraped
follower counts/bios as best-effort, and expect the spider's meta-tag
selectors to need occasional updates. This also runs against Instagram's own
Terms of Service — that tradeoff is a business decision, not a technical one.
