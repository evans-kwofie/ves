import scrapy


class ProfileItem(scrapy.Item):
    profile_url = scrapy.Field()
    username = scrapy.Field()
    display_name = scrapy.Field()
    bio = scrapy.Field()
    followers = scrapy.Field()
    link_in_bio = scrapy.Field()
    source_post_url = scrapy.Field()
    query_used = scrapy.Field()
