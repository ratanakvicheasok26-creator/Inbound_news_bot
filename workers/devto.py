"""dev.to API client — developer articles filtered by tag.

Free, no API key required. Good for developer content and digital literacy.
"""

from __future__ import annotations

import logging
import time
from datetime import datetime, timezone
from typing import Any
from urllib.parse import urlparse

import httpx

logger = logging.getLogger(__name__)

_API_BASE = "https://dev.to/api"
_TIMEOUT = 15


def _extract_domain(url: str) -> str:
    try:
        return urlparse(url).netloc.replace("www.", "")
    except Exception:
        return ""


def fetch_articles(
    tag: str = "ai",
    per_page: int = 30,
    top: int | None = None,
) -> list[dict[str, Any]]:
    """Fetch dev.to articles by tag.

    Args:
        tag: Tag to filter by (e.g. "ai", "python", "javascript", "webdev").
        per_page: Max results (caps at 1000).
        top: Number of days for top articles (e.g. 7 for top of the week).

    Returns:
        List of dicts with standardized article schema.
    """
    params: dict[str, Any] = {
        "per_page": min(per_page, 30),
        "tag": tag,
    }
    if top:
        params["top"] = top

    try:
        resp = httpx.get(f"{_API_BASE}/articles", params=params, timeout=_TIMEOUT)
        resp.raise_for_status()
        data = resp.json()
    except httpx.TimeoutException:
        logger.warning("dev.to API timed out for tag: %s", tag)
        return []
    except Exception:
        logger.exception("dev.to API request failed")
        return []

    articles: list[dict[str, Any]] = []

    for item in data:
        url = item.get("url", "")
        if not url:
            continue

        title = item.get("title", "").strip()
        if not title:
            continue

        description = item.get("description", "") or ""
        readable = item.get("readable_publish_date", "")
        reading_time = item.get("reading_time_minutes", 0)
        reactions = item.get("positive_reactions_count", 0)
        comments = item.get("comments_count", 0)
        user = item.get("user", {}).get("name", "")

        summary_parts = []
        if description:
            summary_parts.append(description[:200])
        summary_parts.append(f"by {user} | {reading_time} min read | ❤️ {reactions} | 💬 {comments}")
        summary = " | ".join(summary_parts)

        published_at = None
        pub_date = item.get("published_at") or item.get("created_at")
        if pub_date:
            try:
                published_at = datetime.fromisoformat(pub_date.replace("Z", "+00:00")).isoformat()
            except (ValueError, TypeError):
                pass

        tag_list = item.get("tag_list", []) or []

        articles.append({
            "title": title,
            "url": url,
            "source_name": "dev.to",
            "source_domain": "dev.to",
            "summary": summary,
            "published_at": published_at,
            "language": "en",
            "category": tag if tag_list is not None else tag,
            "raw_json": item,
        })

    logger.info("dev.to: %d articles for tag '%s'", len(articles), tag)
    return articles


DEFAULT_TAGS = [
    "ai",
    "python",
    "javascript",
    "webdev",
    "rust",
    "machinelearning",
    "cybersecurity",
    "opensource",
    "devops",
    "cloud",
]


def fetch_all_devto(
    tags: list[str] | None = None,
) -> list[dict[str, Any]]:
    """Fetch dev.to articles across multiple tags, deduplicated by URL."""
    if tags is None:
        tags = DEFAULT_TAGS

    seen_urls: set[str] = set()
    all_articles: list[dict[str, Any]] = []

    for tag in tags:
        articles = fetch_articles(tag=tag, per_page=15)
        for a in articles:
            if a["url"] not in seen_urls:
                seen_urls.add(a["url"])
                all_articles.append(a)
        time.sleep(0.3)

    logger.info("dev.to total: %d unique articles", len(all_articles))
    return all_articles
