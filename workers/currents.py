"""Currents API client — global news from 14,000+ sources in 78 languages.

Free tier: 600 requests/day, no credit card required.
Requires CURRENTS_API_KEY env var.
"""

from __future__ import annotations

import logging
import os
import time
from datetime import datetime
from typing import Any
from urllib.parse import urlparse

import httpx

logger = logging.getLogger(__name__)

_BASE = "https://api.currentsapi.services/v1"
_TIMEOUT = 20


def _extract_domain(url: str) -> str:
    try:
        return urlparse(url).netloc.replace("www.", "")
    except Exception:
        return ""


def fetch_currents(
    category: str = "technology",
    language: str = "en",
    country: str | None = None,
    page_size: int = 30,
) -> list[dict[str, Any]]:
    """Fetch articles from Currents API.

    Args:
        category: news, technology, science, business, health, entertainment, sports.
        language: Language code (en, km, etc.).
        country: Optional country filter (US, KH, etc.).
        page_size: Max results (API caps at 200).

    Returns:
        List of dicts with standardized article schema.
    """
    api_key = os.environ.get("CURRENTS_API_KEY", "").strip()
    if not api_key:
        logger.warning("CURRENTS_API_KEY not set — skipping Currents API")
        return []

    headers = {"Authorization": api_key}
    params: dict[str, Any] = {
        "category": category,
        "language": language,
        "page_size": min(page_size, 50),
    }
    if country:
        params["country"] = country

    try:
        resp = httpx.get(f"{_BASE}/latest-news", params=params, headers=headers, timeout=_TIMEOUT)
        resp.raise_for_status()
        data = resp.json()
    except httpx.TimeoutException:
        logger.warning("Currents API timed out for category: %s", category)
        return []
    except Exception:
        logger.exception("Currents API request failed")
        return []

    news = data.get("news", [])
    articles: list[dict[str, Any]] = []

    for item in news:
        url = item.get("url", "")
        if not url:
            continue

        title = (item.get("title") or "").strip()
        if not title:
            continue

        description = item.get("description", "") or ""
        domain = _extract_domain(url) or item.get("source", {}).get("name", "")

        published_at = None
        pub_date = item.get("published")
        if pub_date:
            try:
                published_at = datetime.fromisoformat(pub_date.replace("Z", "+00:00")).isoformat()
            except (ValueError, TypeError):
                pass

        source_info = item.get("source", {})
        source_name = source_info.get("name", domain) if isinstance(source_info, dict) else str(source_info)

        articles.append({
            "title": title,
            "url": url,
            "source_name": source_name or "Currents API",
            "source_domain": domain,
            "summary": description[:500],
            "image_url": item.get("image") or None,
            "published_at": published_at,
            "language": language,
            "category": category,
            "raw_json": item,
        })

    logger.info("Currents API: %d articles (category=%s)", len(articles), category)
    return articles


def fetch_all_currents(
    categories: list[str] | None = None,
    max_per_category: int = 30,
) -> list[dict[str, Any]]:
    """Run multiple Currents API queries and merge results, deduplicated by URL."""
    if categories is None:
        categories = ["technology", "science", "business"]

    seen_urls: set[str] = set()
    all_articles: list[dict[str, Any]] = []

    for cat in categories:
        articles = fetch_currents(category=cat, page_size=max_per_category)
        for a in articles:
            if a["url"] not in seen_urls:
                seen_urls.add(a["url"])
                all_articles.append(a)
        time.sleep(0.3)

    logger.info("Currents API total: %d unique articles", len(all_articles))
    return all_articles
