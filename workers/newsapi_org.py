"""NewsAPI.org client — news aggregation.

Free tier: 100 req/day, dev/test only (localhost CORS restriction).
Requires API key from https://newsapi.org
"""

from __future__ import annotations

import logging
import os
from datetime import datetime, timezone
from typing import Any
from urllib.parse import urlparse

import httpx

logger = logging.getLogger(__name__)

_API = "https://newsapi.org/v2"
_TIMEOUT = 15


def _get_key() -> str | None:
    return os.environ.get("NEWSAPI_KEY")


def _extract_domain(url: str) -> str:
    try:
        return urlparse(url).netloc.replace("www.", "")
    except Exception:
        return ""


def fetch_everything(
    query: str = "technology",
    language: str = "en",
    sort_by: str = "publishedAt",
    page_size: int = 20,
) -> list[dict[str, Any]]:
    api_key = _get_key()
    if not api_key:
        logger.warning("NEWSAPI_KEY not set, skipping NewsAPI.org")
        return []

    params = {
        "q": query,
        "language": language,
        "sortBy": sort_by,
        "pageSize": min(page_size, 100),
        "apiKey": api_key,
    }

    try:
        resp = httpx.get(f"{_API}/everything", params=params, timeout=_TIMEOUT)
        resp.raise_for_status()
        data = resp.json()
    except Exception:
        logger.exception("NewsAPI.org request failed")
        return []

    articles_raw = data.get("articles", [])
    articles: list[dict[str, Any]] = []

    for item in articles_raw:
        title = item.get("title", "").strip()
        url = item.get("url", "")
        if not title or not url:
            continue

        desc = item.get("description") or ""
        source = item.get("source", {}).get("name", "")

        published_at = None
        pub = item.get("publishedAt")
        if pub:
            try:
                published_at = datetime.fromisoformat(pub.replace("Z", "+00:00")).isoformat()
            except (ValueError, TypeError):
                pass

        articles.append({
            "title": title,
            "url": url,
            "source_name": f"NewsAPI ({source})" if source else "NewsAPI",
            "source_domain": _extract_domain(url),
            "summary": f"Source: {source} | {desc[:300]}" if source else desc[:300],
            "published_at": published_at or datetime.now(timezone.utc).isoformat(),
            "language": language,
            "category": "tech",
            "raw_json": item,
        })

    logger.info("NewsAPI.org: %d articles for '%s'", len(articles), query)
    return articles


QUERIES = [
    "artificial intelligence",
    "cybersecurity",
    "startup",
    "cloud computing",
    "quantum computing",
]


def fetch_all_newsapi() -> list[dict[str, Any]]:
    seen: set[str] = set()
    all_articles: list[dict[str, Any]] = []

    for q in QUERIES:
        for a in fetch_everything(query=q, page_size=10):
            if a["url"] not in seen:
                seen.add(a["url"])
                all_articles.append(a)

    logger.info("NewsAPI.org total: %d unique articles", len(all_articles))
    return all_articles
