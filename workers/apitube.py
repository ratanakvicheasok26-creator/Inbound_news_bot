"""APITube client — news with NLP enrichment.

Free tier: 1,000 req/day. Sentiment, entities, topic classification.
Requires API key from https://apitube.io
"""

from __future__ import annotations

import logging
import os
from datetime import UTC, datetime
from typing import Any
from urllib.parse import urlparse

import httpx

logger = logging.getLogger(__name__)

_API = "https://api.apitube.io/v1"
_TIMEOUT = 15


def _get_key() -> str | None:
    return os.environ.get("APITUBE_API_KEY")


def _extract_domain(url: str) -> str:
    try:
        return urlparse(url).netloc.replace("www.", "")
    except Exception:
        return ""


def fetch_news(
    query: str = "technology",
    language: str = "en",
    page_size: int = 10,
) -> list[dict[str, Any]]:
    api_key = _get_key()
    if not api_key:
        logger.warning("APITUBE_API_KEY not set, skipping APITube")
        return []

    headers = {"X-API-Key": api_key}
    params = {
        "q": query,
        "language": language,
        "size": min(page_size, 10),
    }

    try:
        resp = httpx.get(f"{_API}/news/everything", params=params, headers=headers, timeout=_TIMEOUT)
        resp.raise_for_status()
        data = resp.json()
    except Exception:
        logger.exception("APITube request failed")
        return []

    items = data.get("results", data.get("data", []))
    articles: list[dict[str, Any]] = []

    for item in items:
        if not isinstance(item, dict):
            continue
        title = item.get("title", "").strip()
        url = item.get("url", "")
        if not title or not url:
            continue

        desc = item.get("description") or item.get("summary") or ""
        source = item.get("source", {}).get("name", "") if isinstance(item.get("source"), dict) else str(item.get("source", ""))
        sentiment = item.get("sentiment") or ""
        entities = item.get("entities") or []

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
        if entities:
            ent_names = [e.get("name", "") for e in entities[:5] if isinstance(e, dict)]
            if ent_names:
                summary_parts.append(f"Entities: {', '.join(ent_names)}")
        summary_parts.append(desc[:200])

        articles.append({
            "title": title,
            "url": url,
            "source_name": f"APITube ({source})" if source else "APITube",
            "source_domain": _extract_domain(url),
            "summary": " | ".join(summary_parts),
            "published_at": published_at or datetime.now(UTC).isoformat(),
            "language": language,
            "category": "tech",
            "raw_json": item,
        })

    logger.info("APITube: %d articles for '%s'", len(articles), query)
    return articles


QUERIES = [
    "artificial intelligence",
    "cybersecurity news",
    "tech startup",
    "open source",
    "data privacy regulation",
]


def fetch_all_apitube() -> list[dict[str, Any]]:
    seen: set[str] = set()
    all_articles: list[dict[str, Any]] = []

    for q in QUERIES:
        for a in fetch_news(query=q, page_size=10):
            if a["url"] not in seen:
                seen.add(a["url"])
                all_articles.append(a)

    logger.info("APITube total: %d unique articles", len(all_articles))
    return all_articles
