"""GNews API client — Google News-backed news aggregation.

Free tier: 100 requests/day, 10 articles per request.
Requires a free API key from https://gnews.io
"""

from __future__ import annotations

import logging
import os
import time
from datetime import datetime, timezone
from typing import Any
from urllib.parse import urlparse

import httpx

logger = logging.getLogger(__name__)

_API_BASE = "https://gnews.io/api/v4"
_TIMEOUT = 15


def _get_api_key() -> str | None:
    return os.environ.get("GNEWS_API_KEY")


def _extract_domain(url: str) -> str:
    try:
        return urlparse(url).netloc.replace("www.", "")
    except Exception:
        return ""


def fetch_search(
    query: str = "technology",
    lang: str = "en",
    country: str = "us",
    max_results: int = 10,
    sort_by: str = "publishedAt",
) -> list[dict[str, Any]]:
    """Search GNews for articles.

    Args:
        query: Search query.
        lang: Language code.
        country: Country code.
        max_results: Max results per request (max 10).
        sort_by: Sort order (publishedAt, relevance).

    Returns:
        List of dicts with standardized article schema.
    """
    api_key = _get_api_key()
    if not api_key:
        logger.warning("GNEWS_API_KEY not set, skipping GNews")
        return []

    params = {
        "q": query,
        "lang": lang,
        "country": country,
        "max": min(max_results, 10),
        "sortBy": sort_by,
        "token": api_key,
    }

    try:
        resp = httpx.get(f"{_API_BASE}/search", params=params, timeout=_TIMEOUT)
        resp.raise_for_status()
        data = resp.json()
    except httpx.TimeoutException:
        logger.warning("GNews timed out for query: %s", query)
        return []
    except Exception:
        logger.exception("GNews request failed")
        return []

    articles_data = data.get("articles", [])
    articles: list[dict[str, Any]] = []

    for item in articles_data:
        title = item.get("title", "").strip()
        url = item.get("url", "")
        if not title or not url:
            continue

        description = item.get("description", "") or ""
        source = item.get("source", {})
        source_name = source.get("name", "") if isinstance(source, dict) else str(source)

        published_at = None
        pub_date = item.get("publishedAt")
        if pub_date:
            try:
                published_at = datetime.fromisoformat(pub_date.replace("Z", "+00:00")).isoformat()
            except (ValueError, TypeError):
                pass

        summary = description[:300]
        if source_name:
            summary = f"Source: {source_name} | {summary}"

        articles.append({
            "title": title,
            "url": url,
            "source_name": f"GNews ({source_name})" if source_name else "GNews",
            "source_domain": _extract_domain(url),
            "summary": summary,
            "published_at": published_at or datetime.now(timezone.utc).isoformat(),
            "language": lang,
            "category": "tech",
            "raw_json": item,
        })

    logger.info("GNews: %d articles for '%s'", len(articles), query)
    return articles


def fetch_top_headlines(
    lang: str = "en",
    country: str = "us",
    max_results: int = 10,
    topic: str = "technology",
) -> list[dict[str, Any]]:
    """Fetch top technology headlines."""
    api_key = _get_api_key()
    if not api_key:
        return []

    params = {
        "lang": lang,
        "country": country,
        "max": min(max_results, 10),
        "topic": topic,
        "token": api_key,
    }

    try:
        resp = httpx.get(f"{_API_BASE}/top-headlines", params=params, timeout=_TIMEOUT)
        resp.raise_for_status()
        data = resp.json()
    except Exception:
        logger.exception("GNews top headlines request failed")
        return []

    articles_data = data.get("articles", [])
    articles: list[dict[str, Any]] = []

    for item in articles_data:
        title = item.get("title", "").strip()
        url = item.get("url", "")
        if not title or not url:
            continue

        description = item.get("description", "") or ""
        source = item.get("source", {})
        source_name = source.get("name", "") if isinstance(source, dict) else str(source)

        published_at = None
        pub_date = item.get("publishedAt")
        if pub_date:
            try:
                published_at = datetime.fromisoformat(pub_date.replace("Z", "+00:00")).isoformat()
            except (ValueError, TypeError):
                pass

        articles.append({
            "title": title,
            "url": url,
            "source_name": f"GNews ({source_name})" if source_name else "GNews",
            "source_domain": _extract_domain(url),
            "summary": f"{description[:300]}" if description else "",
            "published_at": published_at or datetime.now(timezone.utc).isoformat(),
            "language": lang,
            "category": "tech",
            "raw_json": item,
        })

    logger.info("GNews headlines: %d articles", len(articles))
    return articles


DEFAULT_QUERIES = [
    "artificial intelligence",
    "cybersecurity",
    "startup funding",
    "tech regulation",
    "open source",
    "cloud computing",
    "quantum computing",
]


def fetch_all_gnews(
    queries: list[str] | None = None,
) -> list[dict[str, Any]]:
    """Fetch GNews across multiple queries, deduplicated by URL."""
    if queries is None:
        queries = DEFAULT_QUERIES

    seen_urls: set[str] = set()
    all_articles: list[dict[str, Any]] = []

    # Top headlines first
    for a in fetch_top_headlines():
        if a["url"] not in seen_urls:
            seen_urls.add(a["url"])
            all_articles.append(a)

    time.sleep(0.5)

    # Search queries
    for query in queries:
        articles = fetch_search(query=query, max_results=10)
        for a in articles:
            if a["url"] not in seen_urls:
                seen_urls.add(a["url"])
                all_articles.append(a)
        time.sleep(0.5)

    logger.info("GNews total: %d unique articles", len(all_articles))
    return all_articles
