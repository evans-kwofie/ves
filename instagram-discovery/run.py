"""Entry point: audience description -> Google discovery -> Scrapy/Playwright
crawl (post->profile resolution + extraction) -> filter -> pushed into ves.

Usage:
    python run.py "fitness coaches in Ghana targeting weight loss clients"
"""
import argparse
import os
import sys

from dotenv import load_dotenv
from scrapy.crawler import CrawlerProcess
from scrapy.utils.project import get_project_settings

from query_builder import build_queries
from search_client import discover_urls
from instagram_discovery.spiders.instagram import InstagramSpider

load_dotenv()

REQUIRED_ENV = ["SERPER_API_KEY", "VES_API_URL", "VES_ORG_ID", "INSTAGRAM_SCRAPER_TOKEN"]


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("audience", help='Target audience description, e.g. "fitness coaches in Ghana"')
    parser.add_argument("--max-queries", type=int, default=4)
    parser.add_argument("--results-per-query", type=int, default=10)
    args = parser.parse_args()

    missing = [k for k in REQUIRED_ENV if not os.environ.get(k)]
    if missing:
        sys.exit(f"Missing required env vars: {', '.join(missing)} (see .env.example)")

    queries = build_queries(args.audience, max_variants=args.max_queries)
    if not queries:
        sys.exit("Could not extract any keywords from the audience description.")

    print(f"Running {len(queries)} query variant(s):")
    for q in queries:
        print(f"  {q}")

    urls = discover_urls(queries, os.environ["SERPER_API_KEY"], num_results=args.results_per_query)
    print(f"Discovered {len(urls)} candidate URLs after filtering/dedup.")
    if not urls:
        sys.exit("No candidate URLs found — try a broader audience description.")

    process = CrawlerProcess(get_project_settings())
    process.crawl(InstagramSpider, start_urls=urls, query_used=queries[0])
    process.start()


if __name__ == "__main__":
    main()
