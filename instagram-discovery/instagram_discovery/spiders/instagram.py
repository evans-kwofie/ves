"""Post -> profile resolution and profile extraction.

Instagram embeds most of what we need in <meta> tags rather than the DOM,
which is more stable across their frequent UI/markup changes — so we parse
those first and only fall back to visible text if a tag is missing. Pages are
JS-heavy, hence the Playwright download handler (see settings.py).
"""
from __future__ import annotations

import re

import scrapy

from ..items import ProfileItem

POST_URL_RE = re.compile(r"instagram\.com/(p|reel)/")
# "NAME (@username) on Instagram: ..." — og:title format on post/reel pages.
OG_TITLE_USER_RE = re.compile(r"\(@([A-Za-z0-9_.]+)\)")
# "39K Followers, 219 Following, 543 Posts - See Instagram ... from NAME (@username)"
STATS_RE = re.compile(
    r"([\d.,]+[KMB]?)\s*Followers.*?from\s+(.*?)\s*\(@([A-Za-z0-9_.]+)\)",
    re.IGNORECASE | re.DOTALL,
)


def parse_follower_count(raw: str) -> int | None:
    raw = raw.strip().upper().replace(",", "")
    multiplier = 1
    if raw.endswith("K"):
        multiplier, raw = 1_000, raw[:-1]
    elif raw.endswith("M"):
        multiplier, raw = 1_000_000, raw[:-1]
    elif raw.endswith("B"):
        multiplier, raw = 1_000_000_000, raw[:-1]
    try:
        return int(float(raw) * multiplier)
    except ValueError:
        return None


class InstagramSpider(scrapy.Spider):
    name = "instagram"

    custom_settings = {
        "PLAYWRIGHT_DEFAULT_NAVIGATION_TIMEOUT": 30000,
    }

    def __init__(self, start_urls=None, query_used="", *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.start_urls = start_urls or []
        self.query_used = query_used

    def start_requests(self):
        for url in self.start_urls:
            yield scrapy.Request(
                url,
                callback=self.parse_post if POST_URL_RE.search(url) else self.parse_profile,
                meta={
                    "playwright": True,
                    "source_post_url": url if POST_URL_RE.search(url) else None,
                },
                errback=self.handle_error,
            )

    def parse_post(self, response):
        og_title = response.css('meta[property="og:title"]::attr(content)').get("")
        m = OG_TITLE_USER_RE.search(og_title)
        if not m:
            self.logger.warning("Could not resolve profile from post %s", response.url)
            return
        username = m.group(1)
        profile_url = f"https://www.instagram.com/{username}/"
        yield scrapy.Request(
            profile_url,
            callback=self.parse_profile,
            meta={"playwright": True, "source_post_url": response.url},
            errback=self.handle_error,
        )

    def parse_profile(self, response):
        og_desc = response.css('meta[property="og:description"]::attr(content)').get("")
        m = STATS_RE.search(og_desc or "")

        item = ProfileItem()
        item["profile_url"] = response.url.rstrip("/") + "/"
        item["query_used"] = self.query_used
        item["source_post_url"] = response.meta.get("source_post_url")

        if m:
            item["followers"] = parse_follower_count(m.group(1))
            item["display_name"] = m.group(2).strip()
            item["username"] = m.group(3)
        else:
            # Fallback: username from URL, no reliable follower count without login.
            item["username"] = response.url.rstrip("/").rsplit("/", 1)[-1]
            item["display_name"] = None
            item["followers"] = None

        item["bio"] = og_desc or None
        link_el = response.css('a[href*="l.instagram.com"]::attr(href)').get()
        item["link_in_bio"] = link_el

        yield item

    def handle_error(self, failure):
        self.logger.warning("Request failed: %s\n%s", failure.request.url, failure.getTraceback())
