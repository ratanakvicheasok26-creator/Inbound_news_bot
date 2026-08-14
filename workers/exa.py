"""Exa.ai client — neural search engine. Search by meaning, not keywords.

Free tier: $10/month in free credits (~1,000 searches/month).
Requires EXA_API_KEY env var.
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

_BASE = "https://api.exa.ai"
_TIMEOUT = 20


def _extract_domain(url: str) -> str:
    try:
        return urlparse(url).netloc.replace("www.", "")
    except Exception:
        return ""


def search_exa(
    query: str,
    num_results: int = 10,
    use_autoprompt: bool = True,
    category: str | None = None,
    start_published_date: str | None = None,
) -> list[dict[str, Any]]:
    """Search using Exa.ai neural search.

    Args:
        query: Natural language query (e.g. "personal blogs about writing memory allocators in C").
        num_results: Max results (API caps at 100).
        use_autoprompt: Let Exa enhance the query.
        category: Filter — "company", "research paper", "news", "linkedin profile", "tweet", "movie", "song", "personal site", "pdf".
        start_published_date: ISO date filter (e.g. "2024-01-01").

    Returns:
        List of dicts with standardized article schema.
    """
    api_key = os.environ.get("EXA_API_KEY", "").strip()
    if not api_key:
        logger.warning("EXA_API_KEY not set — skipping Exa.ai")
        return []

    payload: dict[str, Any] = {
        "query": query,
        "numResults": min(num_results, 30),
        "useAutoprompt": use_autoprompt,
        "contents": {
            "text": True,
        },
    }
    if category:
        payload["category"] = category
    if start_published_date:
        payload["startPublishedDate"] = start_published_date

    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
    }

    try:
        resp = httpx.post(f"{_BASE}/search", json=payload, headers=headers, timeout=_TIMEOUT)
        resp.raise_for_status()
        data = resp.json()
    except httpx.TimeoutException:
        logger.warning("Exa.ai timed out for query: %s", query)
        return []
    except Exception:
        logger.exception("Exa.ai request failed")
        return []

    results = data.get("results", [])
    articles: list[dict[str, Any]] = []

    for item in results:
        url = item.get("url", "")
        if not url:
            continue

        title = item.get("title", "").strip()
        if not title:
            continue

        text = item.get("text", "") or ""
        summary = text[:500] if text else ""

        published_at = None
        pub_date = item.get("publishedDate")
        if pub_date:
            try:
                published_at = datetime.fromisoformat(pub_date.replace("Z", "+00:00")).isoformat()
            except (ValueError, TypeError):
                pass

        author = item.get("author", "")

        articles.append({
            "title": title,
            "url": url,
            "source_name": f"Exa.ai ({_extract_domain(url)})",
            "source_domain": _extract_domain(url),
            "summary": summary,
            "published_at": published_at,
            "language": "en",
            "category": category,
            "raw_json": item,
        })

    logger.info("Exa.ai: %d results for query '%s'", len(articles), query)
    return articles


DEFAULT_QUERIES = [
    "artificial intelligence safety research",
    "personal developer blogs about systems programming",
    "Cambodia tech startup ecosystem",
    "open source AI tools and frameworks",
    "cybersecurity research papers 2026",
]


def fetch_all_exa(
    queries: list[str] | None = None,
    max_per_query: int = 10,
) -> list[dict[str, Any]]:
    """Run multiple Exa.ai searches and merge results."""
    if queries is None:
        queries = DEFAULT_QUERIES

    seen_urls: set[str] = set()
    all_articles: list[dict[str, Any]] = []

    for q in queries:
        articles = search_exa(query=q, num_results=max_per_query)
        for a in articles:
            if a["url"] not in seen_urls:
                seen_urls.add(a["url"])
                all_articles.append(a)
        time.sleep(1)  # Rate limit: respect free tier

    logger.info("Exa.ai total: %d unique results", len(all_articles))
    return all_articles
