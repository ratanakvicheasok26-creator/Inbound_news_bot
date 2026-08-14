"""Crossref API client — academic papers and citations.

Free, no API key required (mailto in User-Agent recommended for polite pool).
Access to 180M+ scholarly works. Useful for tracking cutting-edge research
that may become mainstream tech news.
"""

from __future__ import annotations

import logging
import time
from datetime import UTC, datetime
from typing import Any
from urllib.parse import urlparse

import httpx

logger = logging.getLogger(__name__)

_API_BASE = "https://api.crossref.org/works"
_USER_AGENT = "InboundNewsBot/1.0 (https://github.com/sothunly-alt/Inbound_news_bot; mailto:ratharo69@gmail.com)"
_TIMEOUT = 20


def _extract_domain(url: str) -> str:
    try:
        return urlparse(url).netloc.replace("www.", "")
    except Exception:
        return ""


def _format_date(date_parts: list | None) -> str | None:
    """Try to parse Crossref date-parts into ISO format."""
    if not date_parts or not date_parts[0]:
        return None
    parts = date_parts[0]
    try:
        if len(parts) >= 3:
            return datetime(parts[0], parts[1], parts[2], tzinfo=UTC).isoformat()
        if len(parts) == 2:
            return datetime(parts[0], parts[1], 1, tzinfo=UTC).isoformat()
        if len(parts) == 1:
            return datetime(parts[0], 1, 1, tzinfo=UTC).isoformat()
    except (ValueError, TypeError):
        pass
    return None


def fetch_papers(
    query: str = "artificial intelligence",
    rows: int = 20,
    sort: str = "published",
    order: str = "desc",
) -> list[dict[str, Any]]:
    """Search Crossref for recent academic papers.

    Args:
        query: Search query string.
        rows: Number of results (max 100).
        sort: Sort field (published, relevance, is-referenced-by-count).
        order: Sort order (asc, desc).

    Returns:
        List of dicts with standardized article schema.
    """
    headers = {"User-Agent": _USER_AGENT}
    params = {
        "query": query,
        "rows": min(rows, 100),
        "sort": sort,
        "order": order,
        "filter": "type:journal-article,type:proceedings-article,type:posted-content",
    }

    try:
        resp = httpx.get(_API_BASE, params=params, headers=headers, timeout=_TIMEOUT)
        resp.raise_for_status()
        data = resp.json()
    except httpx.TimeoutException:
        logger.warning("Crossref timed out for query: %s", query)
        return []
    except Exception:
        logger.exception("Crossref API request failed")
        return []

    items = data.get("message", {}).get("items", [])
    articles: list[dict[str, Any]] = []

    for item in items:
        # Get DOI link
        doi = item.get("DOI", "")
        title_list = item.get("title", [])
        title = title_list[0] if title_list else ""
        if not title or not doi:
            continue

        # Build URL
        url = item.get("link", [{}])[0].get("URL", f"https://doi.org/{doi}")

        # Get journal/conference name
        container = item.get("container-title", [])
        journal = container[0] if container else ""

        # Get abstract (may contain HTML tags)
        abstract = item.get("abstract", "") or ""
        if abstract:
            import re
            abstract = re.sub(r"<[^>]+>", "", abstract).strip()

        # Get citation count
        cited_by = item.get("is-referenced-by-count", 0)

        # Get authors
        authors = item.get("author", [])
        author_names = [f"{a.get('given', '')} {a.get('family', '')}".strip() for a in authors[:3]]
        author_str = ", ".join(author_names)
        if len(authors) > 3:
            author_str += f" et al. ({len(authors)} authors)"

        # Published date
        pub_date = _format_date(item.get("published-print", {}).get("date-parts"))
        if not pub_date:
            pub_date = _format_date(item.get("published-online", {}).get("date-parts"))
        if not pub_date:
            pub_date = _format_date(item.get("created", {}).get("date-parts"))

        # Subjects/topics
        subjects = item.get("subject", [])

        summary_parts = []
        if abstract:
            summary_parts.append(abstract[:250])
        if journal:
            summary_parts.append(f"Published in: {journal}")
        if author_str:
            summary_parts.append(f"Authors: {author_str}")
        if cited_by:
            summary_parts.append(f"Cited by: {cited_by}")
        if subjects:
            summary_parts.append(f"Topics: {', '.join(subjects[:5])}")
        summary = " | ".join(summary_parts) if summary_parts else f"DOI: {doi}"

        articles.append({
            "title": title.strip(),
            "url": url,
            "source_name": "Crossref",
            "source_domain": _extract_domain(url),
            "summary": summary,
            "published_at": pub_date,
            "language": "en",
            "category": "research",
            "raw_json": {k: v for k, v in item.items() if k not in ("abstract",)},
        })

    logger.info("Crossref: %d papers for query '%s'", len(articles), query)
    return articles


DEFAULT_QUERIES = [
    "artificial intelligence",
    "large language model",
    "cybersecurity",
    "quantum computing",
    "machine learning",
    "natural language processing",
    "computer vision",
    "blockchain technology",
    "edge computing",
    "federated learning",
    "reinforcement learning",
    "generative adversarial network",
    "tech policy regulation",
    "privacy preserving computation",
    "autonomous systems",
]


def fetch_all_crossref(
    queries: list[str] | None = None,
    rows_per_query: int = 10,
) -> list[dict[str, Any]]:
    """Search Crossref across multiple queries, deduplicated by DOI/URL."""
    if queries is None:
        queries = DEFAULT_QUERIES

    seen_urls: set[str] = set()
    all_articles: list[dict[str, Any]] = []

    for query in queries:
        articles = fetch_papers(query=query, rows=rows_per_query)
        for a in articles:
            if a["url"] not in seen_urls:
                seen_urls.add(a["url"])
                all_articles.append(a)
        time.sleep(0.5)

    logger.info("Crossref total: %d unique papers", len(all_articles))
    return all_articles
