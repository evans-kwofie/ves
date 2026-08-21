"""Google Search discovery layer via Serper.dev — avoids hitting Instagram's
own search/rate limits directly, and avoids browser automation against Google.
"""
import os
import re

import requests

SERPER_URL = "https://google.serper.dev/search"
POST_URL_RE = re.compile(r"instagram\.com/(p|reel)/[^/?#]+")
PROFILE_URL_RE = re.compile(r"^https?://(www\.)?instagram\.com/([A-Za-z0-9_.]+)/?$")

RESERVED_PATHS = {"p", "reel", "explore", "accounts", "direct", "stories", "tv"}


# Free-tier Serper accounts reject `num` above ~10 for site:-restricted, multi-phrase
# queries ("Query pattern not allowed for free accounts") even though a plain query
# accepts up to 20+. Clamp defensively rather than surfacing a raw 400.
FREE_TIER_MAX_NUM = 10


def run_query(query: str, api_key: str, num_results: int = FREE_TIER_MAX_NUM) -> list[str]:
    num_results = min(num_results, FREE_TIER_MAX_NUM)
    resp = requests.post(
        SERPER_URL,
        headers={"X-API-KEY": api_key, "Content-Type": "application/json"},
        json={"q": query, "num": num_results},
        timeout=15,
    )
    resp.raise_for_status()
    data = resp.json()
    return [r["link"] for r in data.get("organic", []) if "link" in r]


def classify_and_filter(urls: list[str]) -> list[str]:
    """Keeps only post/reel URLs and direct profile URLs, de-duplicated."""
    seen: set[str] = set()
    kept: list[str] = []
    for url in urls:
        if "instagram.com" not in url:
            continue
        if POST_URL_RE.search(url):
            clean = url.split("?")[0].rstrip("/")
        else:
            m = PROFILE_URL_RE.match(url.split("?")[0])
            if not m or m.group(2) in RESERVED_PATHS:
                continue
            clean = url.split("?")[0].rstrip("/")
        if clean not in seen:
            seen.add(clean)
            kept.append(clean)
    return kept


def discover_urls(queries: list[str], api_key: str, num_results: int = FREE_TIER_MAX_NUM) -> list[str]:
    all_urls: list[str] = []
    for q in queries:
        all_urls.extend(run_query(q, api_key, num_results=num_results))
    return classify_and_filter(all_urls)
