"""Backfill story/article image_url from raw_json or og:image.

Requires migration 005_image_urls.sql applied first.

Run: python -m workers.backfill_images
"""

from __future__ import annotations

import logging
import os
import time

from dotenv import load_dotenv

load_dotenv()

from workers.db import get_supabase
from workers.images import extract_image_url, fetch_og_image, is_valid_image_url

logging.basicConfig(
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    level=logging.INFO,
)
logger = logging.getLogger(__name__)

_LIMIT = int(os.environ.get("IMAGE_BACKFILL_LIMIT", "80"))
_FETCH_OG = os.environ.get("IMAGE_BACKFILL_OG", "1") != "0"


def run() -> None:
    sb = get_supabase()
    updated_articles = 0
    updated_stories = 0

    # Articles missing image_url
    offset = 0
    while updated_articles < _LIMIT:
        batch = (
            sb.table("articles")
            .select("id,url,image_url,raw_json")
            .order("ingested_at", desc=True)
            .range(offset, offset + 49)
            .execute()
        ).data or []
        if not batch:
            break
        for article in batch:
            if is_valid_image_url(article.get("image_url")):
                continue
            image = extract_image_url(article)
            if not image and _FETCH_OG and article.get("url"):
                image = fetch_og_image(article["url"])
                time.sleep(0.15)
            if image:
                sb.table("articles").update({"image_url": image}).eq("id", article["id"]).execute()
                updated_articles += 1
                if updated_articles >= _LIMIT:
                    break
        offset += 50
        if len(batch) < 50:
            break

    # Stories missing image_url — pull from linked article or og:image
    offset = 0
    while updated_stories < _LIMIT:
        batch = (
            sb.table("stories")
            .select("id,title,image_url")
            .order("created_at", desc=True)
            .range(offset, offset + 49)
            .execute()
        ).data or []
        if not batch:
            break
        for story in batch:
            if is_valid_image_url(story.get("image_url")):
                continue
            links = (
                sb.table("story_sources")
                .select("article_id,source_url")
                .eq("story_id", story["id"])
                .limit(3)
                .execute()
            ).data or []
            image = None
            page_url = None
            for link in links:
                if link.get("article_id"):
                    arts = (
                        sb.table("articles")
                        .select("id,url,image_url,raw_json")
                        .eq("id", link["article_id"])
                        .limit(1)
                        .execute()
                    ).data or []
                    if arts:
                        page_url = arts[0].get("url") or page_url
                        image = extract_image_url(arts[0]) or arts[0].get("image_url")
                        if is_valid_image_url(image):
                            break
                page_url = link.get("source_url") or page_url
            if not is_valid_image_url(image) and _FETCH_OG and page_url:
                image = fetch_og_image(page_url)
                time.sleep(0.15)
            if is_valid_image_url(image):
                sb.table("stories").update({"image_url": image}).eq("id", story["id"]).execute()
                updated_stories += 1
                if updated_stories >= _LIMIT:
                    break
        offset += 50
        if len(batch) < 50:
            break

    logger.info("Backfill done — articles=%d stories=%d", updated_articles, updated_stories)


if __name__ == "__main__":
    run()
