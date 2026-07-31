"""Bulk RSS ingestion — pulls from feeds_bulk.txt (11K+ feeds), writes to Supabase.

Run: python -m workers.rss_bulk

Env vars required:
    SUPABASE_URL
    SUPABASE_SERVICE_ROLE_KEY

Feed tier:
    Tier 1 (config.py): ~128 curated feeds → Telegram bot (fast)
    Tier 2 (this worker): 11K+ feeds → website ingestion (slow, bulk)
"""

from __future__ import annotations

import concurrent.futures
import html
import json
import logging
import os
import re
import sys
import time
from calendar import timegm
from datetime import datetime, timezone
from pathlib import Path
from typing import Any
from urllib.parse import urlparse

import feedparser
import httpx

from workers.db import get_supabase
from workers.images import extract_image_url

logging.basicConfig(
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    level=logging.INFO,
)
logger = logging.getLogger(__name__)

_FEEDS_FILE = Path(__file__).resolve().parent.parent / "newsbot" / "feeds_bulk.txt"
_FEED_TIMEOUT = 15
_GLOBAL_TIMEOUT = 120
_MAX_WORKERS = 50
_MAX_ITEMS_PER_FEED = 5
_MAX_ENTRY_AGE_HOURS = 72  # wider window than Telegram bot (24h)
_BATCH_SIZE = 100

_TAG_RE = re.compile(r"<[^>]+>")


def _strip_html(text: str) -> str:
    text = re.sub(r"<br\s*/?>", "\n", text, flags=re.IGNORECASE)
    text = re.sub(r"</(p|div|li|h[1-6])>", "\n", text, flags=re.IGNORECASE)
    text = _TAG_RE.sub("", text)
    text = re.sub(r"<[^>]*$", "", text)
    text = html.unescape(html.unescape(text))
    return re.sub(r"[ \t]+", " ", text).strip()


def _extract_domain(url: str) -> str:
    try:
        return urlparse(url).netloc.replace("www.", "")
    except Exception:
        return ""


def _extract_image(entry: Any) -> str | None:
    media_content = getattr(entry, "media_content", None) or entry.get("media_content")
    if media_content:
        for item in media_content:
            url = item.get("url") if isinstance(item, dict) else None
            if url:
                return url

    enclosures = getattr(entry, "enclosures", None) or entry.get("enclosures") or []
    for enc in enclosures:
        href = enc.get("href") or enc.get("url") if isinstance(enc, dict) else None
        enc_type = (enc.get("type") or "") if isinstance(enc, dict) else ""
        if href and str(enc_type).startswith("image/"):
            return href

    return None


def _load_feeds() -> list[str]:
    if not _FEEDS_FILE.exists():
        logger.error("Feed file not found: %s", _FEEDS_FILE)
        return []
    urls: list[str] = []
    with _FEEDS_FILE.open() as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith("#"):
                urls.append(line)
    logger.info("Loaded %d feed URLs from %s", len(urls), _FEEDS_FILE.name)
    return urls


def _fetch_one(url: str) -> list[dict[str, Any]]:
    """Fetch a single RSS feed and return normalized articles."""
    articles: list[dict[str, Any]] = []
    try:
        resp = httpx.get(url, timeout=_FEED_TIMEOUT, follow_redirects=True,
                         headers={"User-Agent": "InboundNewsBot/1.0 (website ingestion)"})
        resp.raise_for_status()
        feed = feedparser.parse(resp.text)
    except Exception:
        return []

    if feed.bozo and not feed.entries:
        return []

    source_name = feed.feed.get("title", _extract_domain(url))
    count = 0
    for entry in feed.entries:
        if count >= _MAX_ITEMS_PER_FEED:
            break

        entry_url = entry.get("link", "")
        if not entry_url:
            continue

        title = (entry.get("title") or "").strip()
        if not title:
            continue

        # Check age
        parsed = getattr(entry, "published_parsed", None) or getattr(entry, "updated_parsed", None)
        published_at = None
        if parsed:
            try:
                entry_ts = timegm(parsed)
                age_hours = (time.time() - entry_ts) / 3600
                if age_hours > _MAX_ENTRY_AGE_HOURS:
                    continue
                dt = datetime.fromtimestamp(entry_ts, tz=timezone.utc)
                published_at = dt.isoformat()
            except (TypeError, ValueError):
                pass

        summary = _strip_html(entry.get("summary", "") or "")[:500]
        image_url = _extract_image(entry)

        articles.append({
            "title": title,
            "url": entry_url,
            "source_name": source_name,
            "source_domain": _extract_domain(entry_url) or _extract_domain(url),
            "summary": summary,
            "image_url": image_url,
            "published_at": published_at,
            "language": "en",
            "category": None,
            "raw_json": None,
        })
        count += 1

    return articles


def _upsert_articles(articles: list[dict[str, Any]]) -> int:
    if not articles:
        return 0

    supabase = get_supabase()
    inserted = 0

    for i in range(0, len(articles), _BATCH_SIZE):
        batch = articles[i : i + _BATCH_SIZE]
        rows = []
        for a in batch:
            image_url = a.get("image_url") or extract_image_url(a)
            rows.append({
                "title": a["title"],
                "summary": a.get("summary", ""),
                "url": a["url"],
                "source_name": a.get("source_name", ""),
                "source_domain": a.get("source_domain", ""),
                "category": a.get("category"),
                "language": a.get("language", "en"),
                "published_at": a.get("published_at"),
                "image_url": image_url,
                "raw_json": json.dumps(a.get("raw_json")) if a.get("raw_json") else None,
            })

        try:
            result = supabase.table("articles").upsert(
                rows, on_conflict="url", ignore_duplicates=True
            ).execute()
            inserted += len(result.data) if result.data else 0
        except Exception as exc:
            if "image_url" in str(exc):
                for row in rows:
                    row.pop("image_url", None)
                try:
                    result = supabase.table("articles").upsert(
                        rows, on_conflict="url", ignore_duplicates=True
                    ).execute()
                    inserted += len(result.data) if result.data else 0
                    continue
                except Exception:
                    pass
            logger.exception("Failed to upsert batch %d–%d", i, i + _BATCH_SIZE)

    return inserted


def run() -> None:
    feed_urls = _load_feeds()
    if not feed_urls:
        return

    logger.info("Fetching %d feeds with %d workers (timeout: %ds)...",
                len(feed_urls), _MAX_WORKERS, _GLOBAL_TIMEOUT)

    all_articles: list[dict[str, Any]] = []
    completed = 0

    with concurrent.futures.ThreadPoolExecutor(max_workers=_MAX_WORKERS) as pool:
        future_to_url = {pool.submit(_fetch_one, u): u for u in feed_urls}
        try:
            for future in concurrent.futures.as_completed(future_to_url, timeout=_GLOBAL_TIMEOUT):
                url = future_to_url[future]
                try:
                    articles = future.result(timeout=_FEED_TIMEOUT + 5)
                    all_articles.extend(articles)
                    completed += 1
                except Exception:
                    completed += 1
        except TimeoutError:
            logger.warning("Global timeout hit after %ds — %d/%d feeds completed",
                            _GLOBAL_TIMEOUT, completed, len(feed_urls))

    logger.info("Collected %d articles from %d feeds", len(all_articles), completed)

    if all_articles:
        inserted = _upsert_articles(all_articles)
        logger.info("Inserted %d articles into Supabase", inserted)

    logger.info("Bulk RSS ingestion complete.")


if __name__ == "__main__":
    run()
