BOT_NAME = "instagram_discovery"
SPIDER_MODULES = ["instagram_discovery.spiders"]
NEWSPIDER_MODULE = "instagram_discovery.spiders"

ROBOTSTXT_OBEY = False
DOWNLOAD_DELAY = 2
CONCURRENT_REQUESTS_PER_DOMAIN = 2

DOWNLOAD_HANDLERS = {
    "http": "scrapy_playwright.handler.ScrapyPlaywrightDownloadHandler",
    "https": "scrapy_playwright.handler.ScrapyPlaywrightDownloadHandler",
}
TWISTED_REACTOR = "twisted.internet.asyncioreactor.AsyncioSelectorReactor"
PLAYWRIGHT_LAUNCH_OPTIONS = {"headless": True}
PLAYWRIGHT_BROWSER_TYPE = "chromium"

ITEM_PIPELINES = {
    "instagram_discovery.pipelines.FollowerFilterPipeline": 100,
    "instagram_discovery.pipelines.PushToAppPipeline": 200,
}

LOG_LEVEL = "INFO"
