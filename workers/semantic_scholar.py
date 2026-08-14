"""Semantic Scholar client — AI-powered research graph by Allen Institute for AI.

100% free (100 req/5min without key; higher limits with free key).
Maps 200M+ papers, citations, and AI-generated TLDRs.
"""

from __future__ import annotations

import logging
import time
from datetime import UTC, datetime
from typing import Any
from urllib.parse import urlparse

import httpx

logger = logging.getLogger(__name__)

_BASE = "https://api.semanticscholar.org/graph/v1"
_TIMEOUT = 20

# Fields to request for each paper
_PAPER_FIELDS = "title,abstract,url,year,citationCount,referenceCount,authors,fieldsOfStudy,externalIds,publicationDate"


def _extract_domain(url: str) -> str:
    try:
        return urlparse(url).netloc.replace("www.", "")
    except Exception:
        return ""


def fetch_semantic_scholar(
    query: str = "artificial intelligence",
    limit: int = 30,
    year: str | None = None,
    fields_of_study: str | None = None,
) -> list[dict[str, Any]]:
    """Search Semantic Scholar for papers.

    Args:
        query: Search query.
        limit: Max results (API caps at 100 per request).
        year: Year filter (e.g. "2024-2026").
        fields_of_study: Comma-separated (e.g. "Computer Science,Mathematics").

    Returns:
        List of dicts with standardized article schema.
    """
    params: dict[str, Any] = {
        "query": query,
        "limit": min(limit, 100),
        "fields": _PAPER_FIELDS,
    }
    if year:
        params["year"] = year
    if fields_of_study:
        params["fieldsOfStudy"] = fields_of_study

    data: dict[str, Any] | None = None
    for attempt in range(1, 3):
        try:
            resp = httpx.get(f"{_BASE}/paper/search", params=params, timeout=_TIMEOUT)
            if resp.status_code == 429:
                delay = 3.0 * attempt
                logger.warning(
                    "Semantic Scholar 429 for '%s' (attempt %d/2), sleeping %.0fs",
                    query, attempt, delay,
                )
                time.sleep(delay)
                continue
            resp.raise_for_status()
            data = resp.json()
            break
        except httpx.TimeoutException:
            logger.warning("Semantic Scholar timed out for query: %s", query)
            return []
        except Exception as exc:
            if attempt < 2:
                logger.warning("Semantic Scholar attempt %d/2 failed (%s), retrying", attempt, exc)
                time.sleep(3.0)
            else:
                logger.warning("Semantic Scholar request failed after retries: %s", exc)
                return []

    if data is None:
        return []

    papers = data.get("data", [])
    articles: list[dict[str, Any]] = []

    for paper in papers:
        paper_url = paper.get("url", "")
        if not paper_url:
            continue

        title = (paper.get("title") or "").strip()
        if not title:
            continue

        abstract = paper.get("abstract", "") or ""
        # TLDR is not in basic fields, use abstract
        summary = abstract[:500] if abstract else ""

        authors = [a.get("name", "") for a in (paper.get("authors") or []) if a.get("name")]
        fields = paper.get("fieldsOfStudy") or []
        citation_count = paper.get("citationCount")

        published_at = None
        pub_date = paper.get("publicationDate")
        if pub_date:
            try:
                published_at = datetime.fromisoformat(pub_date).replace(tzinfo=UTC).isoformat()
            except (ValueError, TypeError):
                pass

        articles.append({
            "title": title,
            "url": paper_url,
            "source_name": "Semantic Scholar",
            "source_domain": "semanticscholar.org",
            "summary": summary,
            "published_at": published_at,
            "language": "en",
            "category": fields[0] if fields else None,
            "raw_json": {
                "authors": authors,
                "fields_of_study": fields,
                "citation_count": citation_count,
                "year": paper.get("year"),
                "external_ids": paper.get("externalIds", {}),
            },
        })

    logger.info("Semantic Scholar: %d papers for query '%s'", len(articles), query)
    return articles


DEFAULT_QUERIES = [
    "large language model",
    "artificial intelligence safety",
    "cybersecurity",
    "machine learning",
]


def fetch_all_semantic_scholar(
    queries: list[str] | None = None,
    max_per_query: int = 20,
) -> list[dict[str, Any]]:
    """Run multiple Semantic Scholar searches and merge results."""
    if queries is None:
        queries = DEFAULT_QUERIES

    seen_urls: set[str] = set()
    all_articles: list[dict[str, Any]] = []
    consecutive_empty = 0

    for q in queries:
        articles = fetch_semantic_scholar(query=q, limit=max_per_query)
        if not articles:
            consecutive_empty += 1
            if consecutive_empty >= 2:
                logger.warning("Semantic Scholar rate-limited — skipping remaining queries")
                break
        else:
            consecutive_empty = 0
        for a in articles:
            if a["url"] not in seen_urls:
                seen_urls.add(a["url"])
                all_articles.append(a)
        time.sleep(3.0)  # Unauthenticated tier is ~1 req / few seconds

    logger.info("Semantic Scholar total: %d unique papers", len(all_articles))
    return all_articles
