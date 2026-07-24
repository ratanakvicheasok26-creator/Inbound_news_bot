"""Open Library API client — book metadata and trending.

Free, no API key required. Provides access to 40M+ book records.
Useful for tracking tech book publications, trending topics in
tech literature, and enriching news with book references.
"""

from __future__ import annotations

import logging
import time
from datetime import datetime, timezone
from typing import Any
from urllib.parse import urlparse

import httpx

logger = logging.getLogger(__name__)

_API_BASE = "https://openlibrary.org"
_TIMEOUT = 15


def _extract_domain(url: str) -> str:
    try:
        return urlparse(url).netloc.replace("www.", "")
    except Exception:
        return ""


def search_books(
    query: str = "artificial intelligence",
    limit: int = 20,
    sort: str = "new",
) -> list[dict[str, Any]]:
    """Search Open Library for books.

    Args:
        query: Search query string.
        limit: Number of results (max 50).
        sort: Sort order (new, old, rating, reads, reviews).

    Returns:
        List of dicts with standardized article schema.
    """
    params = {
        "q": query,
        "limit": min(limit, 50),
        "sort": sort,
    }

    try:
        resp = httpx.get(f"{_API_BASE}/search.json", params=params, timeout=_TIMEOUT)
        resp.raise_for_status()
        data = resp.json()
    except httpx.TimeoutException:
        logger.warning("Open Library timed out for query: %s", query)
        return []
    except Exception:
        logger.exception("Open Library request failed")
        return []

    docs = data.get("docs", [])
    articles: list[dict[str, Any]] = []

    for doc in docs:
        title = doc.get("title", "").strip()
        if not title:
            continue

        # Build OL URL from key
        key = doc.get("key", "")
        url = f"{_API_BASE}{key}" if key else ""

        # Get author(s)
        author_names = doc.get("author_name", [])
        author_str = ", ".join(author_names[:3])
        if len(author_names) > 3:
            author_str += f" et al."

        # Get publication info
        first_publish = doc.get("first_publish_year", "")
        publishers = doc.get("publisher", [])
        publisher = publishers[0] if publishers else ""
        isbn_list = doc.get("isbn", [])
        isbn = isbn_list[0] if isbn_list else ""
        edition_count = doc.get("edition_count", 0)

        # Get subjects for context
        subjects = doc.get("subject", []) or []
        subject_str = ", ".join(subjects[:5])

        # Get cover image
        cover_id = doc.get("cover_i", "")
        cover_url = (
            f"https://covers.openlibrary.org/b/id/{cover_id}-M.jpg"
            if cover_id
            else ""
        )

        summary_parts = []
        if author_str:
            summary_parts.append(f"Author(s): {author_str}")
        if first_publish:
            summary_parts.append(f"First published: {first_publish}")
        if publisher:
            summary_parts.append(f"Publisher: {publisher}")
        if edition_count:
            summary_parts.append(f"Editions: {edition_count}")
        if subject_str:
            summary_parts.append(f"Subjects: {subject_str}")
        summary = " | ".join(summary_parts)

        # Use first publish year as approximate date
        published_at = None
        if first_publish:
            try:
                published_at = datetime(int(first_publish), 1, 1, tzinfo=timezone.utc).isoformat()
            except (ValueError, TypeError):
                pass

        articles.append({
            "title": title,
            "url": url,
            "source_name": "Open Library",
            "source_domain": "openlibrary.org",
            "summary": summary,
            "published_at": published_at,
            "language": "en",
            "category": "research",
            "raw_json": {k: v for k, v in doc.items() if k != "seed"},
        })

    logger.info("Open Library: %d books for query '%s'", len(articles), query)
    return articles


def fetch_recent_tech_books() -> list[dict[str, Any]]:
    """Fetch recently published tech books across key topics."""
    tech_queries = [
        "artificial intelligence",
        "cybersecurity",
        "large language model",
        "data science",
        "DevOps",
    ]

    seen_urls: set[str] = set()
    all_articles: list[dict[str, Any]] = []

    for query in tech_queries:
        books = search_books(query=query, limit=5, sort="new")
        for b in books:
            if b["url"] not in seen_urls:
                seen_urls.add(b["url"])
                all_articles.append(b)
        time.sleep(0.5)

    logger.info("Open Library tech books: %d unique books", len(all_articles))
    return all_articles


def fetch_all_openlibrary() -> list[dict[str, Any]]:
    """Fetch trending tech books from Open Library, deduplicated by URL."""
    seen_urls: set[str] = set()
    all_articles: list[dict[str, Any]] = []

    # Recent tech books
    for a in fetch_recent_tech_books():
        if a["url"] not in seen_urls:
            seen_urls.add(a["url"])
            all_articles.append(a)

    logger.info("Open Library total: %d unique books", len(all_articles))
    return all_articles
