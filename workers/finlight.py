"""finlight.me client — curated financial news.

Free tier: 5,000 req/month. Full text, sentiment, ticker filtering.
Requires API key from https://finlight.me
"""

from __future__ import annotations

import logging
import os
from datetime import UTC, datetime
from typing import Any
from urllib.parse import urlparse

import httpx

logger = logging.getLogger(__name__)

_API = "https://api.finlight.me/v2"
_TIMEOUT = 15


def _get_key() -> str | None:
    return os.environ.get("FINLIGHT_API_KEY")


def _extract_domain(url: str) -> str:
    try:
        return urlparse(url).netloc.replace("www.", "")
    except Exception:
        return ""


def fetch_articles(
    query: str = "technology",
    limit: int = 20,
) -> list[dict[str, Any]]:
    api_key = _get_key()
    if not api_key:
        logger.warning("FINLIGHT_API_KEY not set, skipping finlight")
        return []

    headers = {"X-API-KEY": api_key}
    params = {"query": query, "limit": min(limit, 50)}

    try:
        resp = httpx.post(f"{_API}/articles", json=params, headers=headers, timeout=_TIMEOUT)
        resp.raise_for_status()
        data = resp.json()
    except Exception:
        logger.exception("finlight request failed")
        return []

    items = data.get("articles", data.get("data", []))
    articles: list[dict[str, Any]] = []

    for item in (items or []):
        if not isinstance(item, dict):
            continue
        title = item.get("title", "").strip()
        url = item.get("url", "")
        if not title or not url:
            continue

        desc = item.get("description") or item.get("summary") or ""
        source = item.get("source", "") or ""
        sentiment = item.get("sentiment") or ""

        published_at = None
        pub = item.get("published_at") or item.get("date")
        if pub:
            try:
                published_at = datetime.fromisoformat(pub.replace("Z", "+00:00")).isoformat()
            except (ValueError, TypeError):
                pass

        summary_parts = []
        if source:
            summary_parts.append(f"Source: {source}")
        if sentiment:
            summary_parts.append(f"Sentiment: {sentiment}")
        summary_parts.append(desc[:300])

        articles.append({
            "title": title,
            "url": url,
            "source_name": f"finlight ({source})" if source else "finlight",
            "source_domain": _extract_domain(url),
            "summary": " | ".join(summary_parts),
            "published_at": published_at or datetime.now(UTC).isoformat(),
            "language": "en",
            "category": "finance_news",
            "raw_json": item,
        })

    logger.info("finlight: %d articles for '%s'", len(articles), query)
    return articles


QUERIES = [
    "technology",
    "artificial intelligence",
    "semiconductor",
    "cybersecurity",
    "venture capital",
]


def fetch_all_finlight() -> list[dict[str, Any]]:
    seen: set[str] = set()
    all_articles: list[dict[str, Any]] = []

    for q in QUERIES:
        for a in fetch_articles(query=q, limit=10):
            if a["url"] not in seen:
                seen.add(a["url"])
                all_articles.append(a)

    logger.info("finlight total: %d unique articles", len(all_articles))
    return all_articles
