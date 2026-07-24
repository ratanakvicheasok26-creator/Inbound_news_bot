"""WhatsTrending API client — AI news and model rankings.

Free, no API key required. Provides AI industry news, model benchmarks,
and trending AI topics.
"""

from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Any
from urllib.parse import urlparse

import httpx

logger = logging.getLogger(__name__)

_API_BASE = "https://whatstrending.ai/api"
_TIMEOUT = 15


def _extract_domain(url: str) -> str:
    try:
        return urlparse(url).netloc.replace("www.", "")
    except Exception:
        return ""


def fetch_ai_news(limit: int = 20) -> list[dict[str, Any]]:
    """Fetch trending AI news from WhatsTrending.

    Args:
        limit: Number of articles to fetch.

    Returns:
        List of dicts with standardized article schema.
    """
    headers = {"User-Agent": "InboundNewsBot/1.0"}

    try:
        resp = httpx.get(f"{_API_BASE}/articles", params={"limit": limit}, headers=headers, timeout=_TIMEOUT)
        resp.raise_for_status()
        data = resp.json()
    except httpx.TimeoutException:
        logger.warning("WhatsTrending API timed out")
        return []
    except Exception:
        logger.exception("WhatsTrending API request failed")
        return []

    articles_data = data if isinstance(data, list) else data.get("articles", data.get("data", []))
    articles: list[dict[str, Any]] = []

    for item in articles_data:
        if not isinstance(item, dict):
            continue

        title = item.get("title", "").strip()
        url = item.get("url", "") or item.get("link", "")
        if not title or not url:
            continue

        description = item.get("description", "") or item.get("summary", "") or ""
        source = item.get("source", "") or item.get("site", "")

        published_at = None
        pub_date = item.get("published_at") or item.get("date") or item.get("created_at")
        if pub_date:
            try:
                if isinstance(pub_date, str):
                    published_at = datetime.fromisoformat(pub_date.replace("Z", "+00:00")).isoformat()
            except (ValueError, TypeError):
                pass

        summary = description[:300]
        if source:
            summary = f"Source: {source} | {summary}"

        articles.append({
            "title": title,
            "url": url,
            "source_name": "WhatsTrending",
            "source_domain": _extract_domain(url) or "whatstrending.ai",
            "summary": summary,
            "published_at": published_at or datetime.now(timezone.utc).isoformat(),
            "language": "en",
            "category": "ai",
            "raw_json": item,
        })

    logger.info("WhatsTrending: %d AI articles", len(articles))
    return articles


def fetch_model_rankings() -> list[dict[str, Any]]:
    """Fetch current AI model rankings/benchmarks."""
    headers = {"User-Agent": "InboundNewsBot/1.0"}

    try:
        resp = httpx.get(f"{_API_BASE}/models", headers=headers, timeout=_TIMEOUT)
        resp.raise_for_status()
        data = resp.json()
    except Exception:
        logger.exception("WhatsTrending models request failed")
        return []

    models = data if isinstance(data, list) else data.get("models", data.get("data", []))
    articles: list[dict[str, Any]] = []

    for item in models:
        if not isinstance(item, dict):
            continue

        name = item.get("name", "") or item.get("model", "")
        if not name:
            continue

        score = item.get("score") or item.get("rating") or item.get("rank")
        category = item.get("category", "") or item.get("type", "")

        summary_parts = []
        if score:
            summary_parts.append(f"Score: {score}")
        if category:
            summary_parts.append(f"Category: {category}")
        summary = " | ".join(summary_parts) if summary_parts else f"AI model: {name}"

        articles.append({
            "title": f"Model ranking: {name}",
            "url": "https://whatstrending.ai",
            "source_name": "WhatsTrending",
            "source_domain": "whatstrending.ai",
            "summary": summary,
            "published_at": datetime.now(timezone.utc).isoformat(),
            "language": "en",
            "category": "ai",
            "raw_json": item,
        })

    logger.info("WhatsTrending: %d model rankings", len(articles))
    return articles


def fetch_all_whats_trending() -> list[dict[str, Any]]:
    """Fetch all WhatsTrending data, deduplicated by URL."""
    seen_urls: set[str] = set()
    all_articles: list[dict[str, Any]] = []

    for a in fetch_ai_news(limit=30):
        if a["url"] not in seen_urls:
            seen_urls.add(a["url"])
            all_articles.append(a)

    for a in fetch_model_rankings()[:10]:
        if a["url"] not in seen_urls:
            seen_urls.add(a["url"])
            all_articles.append(a)

    logger.info("WhatsTrending total: %d unique items", len(all_articles))
    return all_articles
