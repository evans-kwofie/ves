import os

import requests
from itemadapter import ItemAdapter
from scrapy.exceptions import DropItem


class FollowerFilterPipeline:
    """Drops profiles outside the configured follower range."""

    def open_spider(self, spider):
        self.min_followers = int(os.environ.get("MIN_FOLLOWERS") or 0)
        max_raw = os.environ.get("MAX_FOLLOWERS")
        self.max_followers = int(max_raw) if max_raw else None

    def process_item(self, item, spider):
        followers = ItemAdapter(item).get("followers")
        if followers is None:
            return item  # couldn't determine — let it through, don't silently drop leads
        if followers < self.min_followers:
            raise DropItem(f"Below min followers: {followers}")
        if self.max_followers is not None and followers > self.max_followers:
            raise DropItem(f"Above max followers: {followers}")
        return item


class PushToAppPipeline:
    """Batches resolved profiles and POSTs them to the ves /api/discover/instagram/add endpoint."""

    BATCH_SIZE = 50

    def open_spider(self, spider):
        self.api_url = os.environ["VES_API_URL"].rstrip("/") + "/api/discover/instagram/add"
        self.org_id = os.environ["VES_ORG_ID"]
        self.token = os.environ["INSTAGRAM_SCRAPER_TOKEN"]
        self.batch: list[dict] = []

    def process_item(self, item, spider):
        adapter = ItemAdapter(item)
        self.batch.append(
            {
                "profileUrl": adapter["profile_url"],
                "username": adapter["username"],
                "displayName": adapter.get("display_name"),
                "bio": adapter.get("bio"),
                "followers": adapter.get("followers"),
                "linkInBio": adapter.get("link_in_bio"),
                "sourcePostUrl": adapter.get("source_post_url"),
                "queryUsed": adapter.get("query_used"),
            }
        )
        if len(self.batch) >= self.BATCH_SIZE:
            self._flush(spider)
        return item

    def close_spider(self, spider):
        if self.batch:
            self._flush(spider)

    def _flush(self, spider):
        try:
            resp = requests.post(
                self.api_url,
                headers={"Authorization": f"Bearer {self.token}"},
                json={"organizationId": self.org_id, "profiles": self.batch},
                timeout=15,
            )
            resp.raise_for_status()
            spider.logger.info("Pushed %d profiles: %s", len(self.batch), resp.json())
        except requests.RequestException as e:
            spider.logger.error("Failed to push batch to ves API: %s", e)
        finally:
            self.batch = []
