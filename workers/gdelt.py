"""GDELT DOC 2.0 client — pulls global tech news from thousands of domains.

GDELT is unlimited, free, no API key needed. Returns article links + metadata.
"""

from __future__ import annotations

import logging
import time
from datetime import UTC, datetime
from typing import Any
from urllib.parse import urlparse

import httpx

logger = logging.getLogger(__name__)

_BASE = "https://api.gdeltproject.org/api/v2/doc/doc"
_TIMEOUT = 20
_MAX_RETRIES = 2
_RETRY_BASE_DELAY = 3.0
_QUERY_PACING = 2.0  # keep light; abort early when rate-limited


def _extract_domain(url: str) -> str:
    try:
        return urlparse(url).netloc.replace("www.", "")
    except Exception:
        return ""


def fetch_gdelt(
    query: str = "technology OR AI OR cybersecurity OR startup",
    max_records: int = 50,
    timespan: str = "1h",
) -> list[dict[str, Any]]:
    """Fetch articles from GDELT DOC 2.0.

    Args:
        query: Search query (see GDELT docs for syntax).
        max_records: Max articles per request (GDELT caps at 250).
        timespan: How far back to look (1h, 6h, 1d, 1w, 1m).

    Returns:
        List of dicts with keys: title, url, source_name, source_domain,
        published_at, summary, language, raw_json.
    """
    params = {
        "query": query,
        "format": "json",
        "maxrecords": min(max_records, 250),
        "timespan": timespan,
        "mode": "artlist",
        "sort": "DateDesc",
    }

    data: dict[str, Any] | None = None
    for attempt in range(1, _MAX_RETRIES + 1):
        try:
            resp = httpx.get(_BASE, params=params, timeout=_TIMEOUT, follow_redirects=True)
            if resp.status_code == 429:
                delay = _RETRY_BASE_DELAY * (2 ** (attempt - 1))
                logger.warning(
                    "GDELT 429 for '%s' (attempt %d/%d), sleeping %.0fs",
                    query, attempt, _MAX_RETRIES, delay,
                )
                time.sleep(delay)
                continue
            resp.raise_for_status()
            content_type = (resp.headers.get("content-type") or "").lower()
            body = resp.text.strip()
            if not body or "json" not in content_type and not body.startswith("{"):
                # GDELT sometimes returns empty/HTML bodies with HTTP 200
                logger.warning("GDELT non-JSON body for '%s' (len=%d)", query, len(body))
                return []
            data = resp.json()
            break
        except httpx.TimeoutException:
            logger.warning("GDELT query timed out: %s", query)
            return []
        except Exception as exc:
            if attempt < _MAX_RETRIES:
                delay = _RETRY_BASE_DELAY * (2 ** (attempt - 1))
                logger.warning(
                    "GDELT attempt %d/%d failed for '%s' (%s), retrying in %.0fs",
                    attempt, _MAX_RETRIES, query, exc, delay,
                )
                time.sleep(delay)
            else:
                logger.warning("GDELT request failed after retries: %s (%s)", query, exc)
                return []

    if data is None:
        return []

    articles_raw = data.get("articles", [])
    if not articles_raw:
        logger.debug("GDELT returned 0 articles for query: %s", query)
        return []

    articles: list[dict[str, Any]] = []
    for item in articles_raw:
        url = item.get("url", "")
        if not url:
            continue

        domain = _extract_domain(url)
        title = item.get("title", "").strip()
        if not title:
            continue

        # Parse date
        seendate = item.get("seendate", "")
        published_at = None
        if seendate:
            try:
                published_at = datetime.strptime(seendate, "%Y%m%dT%H%M%SZ").replace(
                    tzinfo=UTC
                )
            except (ValueError, TypeError):
                pass

        articles.append({
            "title": title,
            "url": url,
            "source_name": domain,
            "source_domain": domain,
            "summary": item.get("title", "") or "",
            "image_url": item.get("socialimage") or None,
            "published_at": published_at.isoformat() if published_at else None,
            "language": item.get("language", "en"),
            "category": None,
            "raw_json": item,
        })

    logger.info("GDELT: %d articles for query '%s'", len(articles), query)
    return articles


# Default queries — keep short; GDELT rate-limits hard on burst traffic
DEFAULT_QUERIES = [
    "technology OR tech OR startup",
    "artificial intelligence OR AI OR machine learning",
    "cybersecurity OR data breach OR ransomware",
    "blockchain OR cryptocurrency OR defi",
    "Cambodia OR Cambodian OR Khmer",
]


def fetch_all_gdelt(queries: list[str] | None = None, max_per_query: int = 50) -> list[dict[str, Any]]:
    """Run multiple GDELT queries and merge results, deduplicating by URL."""
    if queries is None:
        queries = DEFAULT_QUERIES

    seen_urls: set[str] = set()
    all_articles: list[dict[str, Any]] = []
    consecutive_empty = 0

    for q in queries:
        articles = fetch_gdelt(query=q, max_records=max_per_query)
        if not articles:
            consecutive_empty += 1
            # After two dead queries (429 / empty body), stop burning the quota.
            if consecutive_empty >= 2:
                logger.warning("GDELT rate-limited or empty — skipping remaining queries")
                break
        else:
            consecutive_empty = 0
        for a in articles:
            if a["url"] not in seen_urls:
                seen_urls.add(a["url"])
                all_articles.append(a)
        time.sleep(_QUERY_PACING)

    logger.info("GDELT total: %d unique articles from %d queries", len(all_articles), len(queries))
    return all_articles
