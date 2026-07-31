"""Hacker News client — via Algolia API (unofficial but better than Firebase).

100% free, no API key required. Supports complex search queries.
"""

from __future__ import annotations

import logging
import time
from datetime import datetime, timezone
from typing import Any
from urllib.parse import urlparse

import httpx

logger = logging.getLogger(__name__)

_ALGOLIA_BASE = "https://hn.algolia.com/api/v1"
_TIMEOUT = 15


def _extract_domain(url: str) -> str:
    try:
        return urlparse(url).netloc.replace("www.", "")
    except Exception:
        return ""


def _parse_hn_date(date_str: str) -> str | None:
    """Parse Algolia's ISO date string."""
    if not date_str:
        return None
    try:
        dt = datetime.fromisoformat(date_str.replace("Z", "+00:00"))
        return dt.isoformat()
    except (ValueError, TypeError):
        return None


def fetch_hn_search(
    query: str = "technology",
    tags: str = "story",
    hits_per_page: int = 30,
    numeric_filters: str | None = None,
) -> list[dict[str, Any]]:
    """Search Hacker News via Algolia API.

    Args:
        query: Search query string.
        tags: Filter by type — "story", "comment", "poll", etc.
        hits_per_page: Max results (Algolia caps at 1000).
        numeric_filters: e.g. "points>100,created_at_i>1721900000"

    Returns:
        List of dicts with standardized article schema.
    """
    params: dict[str, Any] = {
        "query": query,
        "tags": tags,
        "hitsPerPage": min(hits_per_page, 100),
    }
    if numeric_filters:
        params["numericFilters"] = numeric_filters

    try:
        resp = httpx.get(f"{_ALGOLIA_BASE}/search", params=params, timeout=_TIMEOUT)
        resp.raise_for_status()
        data = resp.json()
    except httpx.TimeoutException:
        logger.warning("HN Algolia timed out for query: %s", query)
        return []
    except Exception:
        logger.exception("HN Algolia request failed")
        return []

    hits = data.get("hits", [])
    articles: list[dict[str, Any]] = []

    for hit in hits:
        url = hit.get("url", "")
        hn_id = hit.get("objectID", "")

        # If no external URL, link to HN discussion
        if not url:
            url = f"https://news.ycombinator.com/item?id={hn_id}"

        title = hit.get("title", "").strip()
        if not title:
            continue

        domain = _extract_domain(url) if hit.get("url") else "news.ycombinator.com"
        points = hit.get("points", 0) or 0
        num_comments = hit.get("num_comments", 0) or 0
        author = hit.get("author", "") or ""

        published_at = _parse_hn_date(hit.get("created_at"))
        story_text = (hit.get("story_text") or "").strip()
        if story_text:
            summary = story_text[:500]
        else:
            summary = (
                f"{title}. {points} points on Hacker News"
                + (f" by {author}" if author else "")
                + f" · {num_comments} comments."
            )

        articles.append({
            "title": title,
            "url": url,
            "source_name": f"Hacker News ({domain})" if hit.get("url") else "Hacker News",
            "source_domain": domain,
            "summary": summary,
            "published_at": published_at,
            "language": "en",
            "category": None,
            "raw_json": hit,
        })

    logger.info("HN Algolia: %d stories for query '%s'", len(articles), query)
    return articles


def fetch_hn_frontpage(
    min_points: int = 100,
    hits_per_page: int = 30,
) -> list[dict[str, Any]]:
    """Fetch current HN frontpage stories above a point threshold."""
    import time as _time
    now = int(_time.time())
    one_day_ago = now - 86400

    return fetch_hn_search(
        query="",
        tags="story",
        hits_per_page=hits_per_page,
        numeric_filters=f"points>{min_points},created_at_i>{one_day_ago}",
    )


DEFAULT_QUERIES = [
    "artificial intelligence",
    "machine learning",
    "cybersecurity",
    "startup",
    "open source",
    "cloud computing",
    "Cambodia OR ASEAN",
    "semiconductor OR chip",
    "climate tech",
    "blockchain OR crypto",
]


def fetch_all_hackernews(
    queries: list[str] | None = None,
    min_points: int = 50,
) -> list[dict[str, Any]]:
    """Run multiple HN searches + frontpage, deduplicated by URL."""
    if queries is None:
        queries = DEFAULT_QUERIES

    seen_urls: set[str] = set()
    all_articles: list[dict[str, Any]] = []

    # Frontpage stories
    frontpage = fetch_hn_frontpage(min_points=min_points)
    for a in frontpage:
        if a["url"] not in seen_urls:
            seen_urls.add(a["url"])
            all_articles.append(a)

    # Search queries
    for q in queries:
        articles = fetch_hn_search(query=q, hits_per_page=20)
        for a in articles:
            if a["url"] not in seen_urls:
                seen_urls.add(a["url"])
                all_articles.append(a)
        time.sleep(0.3)

    logger.info("HN total: %d unique articles", len(all_articles))
    return all_articles
