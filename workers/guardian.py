"""The Guardian API client — high-quality tech journalism.

Free tier: 12 calls/sec, 500 calls/day. No API key required for basic use.
Get a key at https://open-platform.theguardian.com/ for higher limits.
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

_API_BASE = "https://content.guardianapis.com"
_TIMEOUT = 15


def _extract_domain(url: str) -> str:
    try:
        return urlparse(url).netloc.replace("www.", "")
    except Exception:
        return ""


def _get_api_key() -> str:
    return os.environ.get("GUARDIAN_API_KEY", "test")


def search_articles(
    query: str = "technology",
    section: str = "",
    page_size: int = 30,
    order_by: str = "relevance",
) -> list[dict[str, Any]]:
    """Search Guardian articles.

    Args:
        query: Search query (e.g. "artificial intelligence", "cybersecurity").
        section: Filter by section (e.g. "technology", "world", "business").
        page_size: Max results (caps at 50).
        order_by: "relevance", "newest", or "oldest".

    Returns:
        List of dicts with standardized article schema.
    """
    params: dict[str, Any] = {
        "q": query,
        "page-size": min(page_size, 50),
        "order-by": order_by,
        "show-fields": "headline,trailText,bodyText",
        "api-key": _get_api_key(),
    }
    if section:
        params["section"] = section

    try:
        resp = httpx.get(f"{_API_BASE}/search", params=params, timeout=_TIMEOUT)
        resp.raise_for_status()
        data = resp.json()
    except httpx.TimeoutException:
        logger.warning("Guardian API timed out for query: %s", query)
        return []
    except Exception:
        logger.exception("Guardian API request failed")
        return []

    results = data.get("response", {}).get("results", [])
    articles: list[dict[str, Any]] = []

    for item in results:
        url = item.get("webUrl", "")
        if not url:
            continue

        fields = item.get("fields", {})
        title = fields.get("headline", "") or item.get("webTitle", "")
        if not title:
            continue

        trail = fields.get("trailText", "")
        body = fields.get("bodyText", "")
        summary = trail or (body[:300] + "..." if len(body) > 300 else body) or title

        published_at = None
        pub_date = item.get("webPublicationDate")
        if pub_date:
            try:
                published_at = datetime.fromisoformat(pub_date.replace("Z", "+00:00")).isoformat()
            except (ValueError, TypeError):
                pass

        section_name = item.get("sectionName", "")

        articles.append({
            "title": title,
            "url": url,
            "source_name": f"The Guardian ({section_name})" if section_name else "The Guardian",
            "source_domain": "theguardian.com",
            "summary": summary[:300],
            "published_at": published_at,
            "language": "en",
            "category": section_name.lower() if section_name else None,
            "raw_json": item,
        })

    logger.info("Guardian: %d articles for query '%s'", len(articles), query)
    return articles


DEFAULT_QUERIES = [
    ("artificial intelligence", "technology"),
    ("cybersecurity", "technology"),
    ("semiconductor", "technology"),
    ("climate tech", "technology"),
    ("open source", "technology"),
    ("AI regulation", ""),
    ("data privacy", ""),
    ("tech startup", "business"),
]


def fetch_all_guardian(
    queries: list[tuple[str, str]] | None = None,
) -> list[dict[str, Any]]:
    """Run multiple Guardian searches, deduplicated by URL."""
    if queries is None:
        queries = DEFAULT_QUERIES

    seen_urls: set[str] = set()
    all_articles: list[dict[str, Any]] = []

    for q, section in queries:
        articles = search_articles(query=q, section=section, page_size=20)
        for a in articles:
            if a["url"] not in seen_urls:
                seen_urls.add(a["url"])
                all_articles.append(a)
        time.sleep(0.5)

    logger.info("Guardian total: %d unique articles", len(all_articles))
    return all_articles
