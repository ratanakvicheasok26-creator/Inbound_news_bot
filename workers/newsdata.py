"""NewsData.io client — pulls from 150K+ sources in 170+ languages.

Free tier: 200 credits/day (10 articles/credit = ~2,000 articles/day).
Requires NEWSDATA_API_KEY env var.
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

_BASE = "https://newsdata.io/api/1/news"
_TIMEOUT = 20


def _extract_domain(url: str) -> str:
    try:
        return urlparse(url).netloc.replace("www.", "")
    except Exception:
        return ""


def fetch_newsdata(
    query: str | None = None,
    category: str = "technology",
    country: str = "us",
    language: str = "en",
    page: str | None = None,
) -> tuple[list[dict[str, Any]], str | None]:
    """Fetch articles from NewsData.io.

    Args:
        query: Optional search query.
        category: Category filter (technology, science, business, etc.).
        country: Country code (us, gb, kh, etc.).
        language: Language code (en, km, etc.).
        page: Pagination token from previous response.

    Returns:
        Tuple of (articles_list, next_page_token).
    """
    api_key = os.environ.get("NEWSDATA_API_KEY", "").strip()
    if not api_key:
        logger.warning("NEWSDATA_API_KEY not set — skipping NewsData.io")
        return [], None

    params: dict[str, Any] = {
        "apikey": api_key,
        "category": category,
        "language": language,
    }
    if query:
        params["q"] = query
    if country:
        params["country"] = country
    if page:
        params["page"] = page

    try:
        resp = httpx.get(_BASE, params=params, timeout=_TIMEOUT, follow_redirects=True)
        resp.raise_for_status()
        data = resp.json()
    except httpx.TimeoutException:
        logger.warning("NewsData.io timed out for query: %s", query or category)
        return [], None
    except Exception:
        logger.exception("NewsData.io request failed")
        return [], None

    if data.get("status") == "error":
        logger.warning("NewsData.io error: %s", data.get("results", {}).get("message", "unknown"))
        return [], None

    results = data.get("results", [])
    next_page = data.get("nextPage")

    articles: list[dict[str, Any]] = []
    for item in results:
        url = item.get("link", "")
        if not url:
            continue

        title = item.get("title", "").strip()
        if not title:
            continue

        domain = _extract_domain(url)

        published_at = None
        pub_date = item.get("pubDate")
        if pub_date:
            try:
                published_at = datetime.strptime(pub_date, "%Y-%m-%d %H:%M:%S").replace(
                    tzinfo=timezone.utc
                )
            except (ValueError, TypeError):
                pass

        articles.append({
            "title": title,
            "url": url,
            "source_name": item.get("source_name", domain),
            "source_domain": domain,
            "summary": item.get("description", "") or "",
            "image_url": item.get("image_url") or None,
            "published_at": published_at.isoformat() if published_at else None,
            "language": item.get("language", language),
            "category": item.get("category", [category])[0] if isinstance(item.get("category"), list) else item.get("category"),
            "raw_json": item,
        })

    logger.info("NewsData.io: %d articles (query=%s, page=%s)", len(articles), query or category, page or "first")
    return articles, next_page


def fetch_all_newsdata(
    queries: list[str] | None = None,
    max_pages: int = 5,
) -> list[dict[str, Any]]:
    """Run multiple NewsData.io queries and merge results."""
    if queries is None:
        queries = ["technology", "artificial intelligence", "cybersecurity", "startup"]

    seen_urls: set[str] = set()
    all_articles: list[dict[str, Any]] = []

    for q in queries:
        page = None
        for _ in range(max_pages):
            articles, next_page = fetch_newsdata(query=q, page=page)
            for a in articles:
                if a["url"] not in seen_urls:
                    seen_urls.add(a["url"])
                    all_articles.append(a)
            if not next_page:
                break
            page = next_page
            time.sleep(0.5)

    logger.info("NewsData.io total: %d unique articles from %d queries", len(all_articles), len(queries))
    return all_articles
