"""OpenAlex client — open catalog of the global research system.

100% free, no API key required. Up to 100,000 requests/day.
Replaced Microsoft Academic Graph. Beautiful REST API.
"""

from __future__ import annotations

import logging
import time
from datetime import UTC, datetime
from typing import Any
from urllib.parse import urlparse

import httpx

logger = logging.getLogger(__name__)

_BASE = "https://api.openalex.org"
_TIMEOUT = 20
_EMAIL = "inboundnewsbot@users.noreply.github.com"  # polite pool for faster responses


def _extract_domain(url: str) -> str:
    try:
        return urlparse(url).netloc.replace("www.", "")
    except Exception:
        return ""


def fetch_openalex_works(
    search: str = "artificial intelligence",
    per_page: int = 30,
    from_publication_date: str | None = None,
    sort: str = "cited_by_count:desc",
) -> list[dict[str, Any]]:
    """Search OpenAlex for research works.

    Args:
        search: Search query.
        per_page: Max results (API caps at 200).
        from_publication_date: Filter (e.g. "2024-01-01").
        sort: Sort order (default: most cited).

    Returns:
        List of dicts with standardized article schema.
    """
    params: dict[str, Any] = {
        "search": search,
        "per_page": min(per_page, 200),
        "sort": sort,
        "mailto": _EMAIL,
    }
    if from_publication_date:
        params["filter"] = f"from_publication_date:{from_publication_date}"

    try:
        resp = httpx.get(f"{_BASE}/works", params=params, timeout=_TIMEOUT)
        resp.raise_for_status()
        data = resp.json()
    except httpx.TimeoutException:
        logger.warning("OpenAlex timed out for search: %s", search)
        return []
    except Exception:
        logger.exception("OpenAlex request failed")
        return []

    results = data.get("results", [])
    articles: list[dict[str, Any]] = []

    for work in results:
        title = (work.get("title") or "").strip()
        if not title:
            continue

        # Get best available URL
        doi = work.get("doi", "")
        primary_url = doi if doi else work.get("id", "")
        if not primary_url:
            continue

        # OpenAlex ID URL
        work_url = work.get("id", primary_url)

        # Abstract — OpenAlex stores inverted index, reconstruct it
        abstract = ""
        abstract_inv = work.get("abstract_inverted_index")
        if abstract_inv and isinstance(abstract_inv, dict):
            try:
                word_positions: list[tuple[int, str]] = []
                for word, positions in abstract_inv.items():
                    for pos in positions:
                        word_positions.append((pos, word))
                word_positions.sort()
                abstract = " ".join(w for _, w in word_positions)[:500]
            except Exception:
                pass

        # Authors
        authorships = work.get("authorships") or []
        authors = [
            a.get("author", {}).get("display_name", "")
            for a in authorships
            if a.get("author", {}).get("display_name")
        ]

        # Topics/concepts
        concepts = work.get("concepts") or []
        tags = [c.get("display_name", "") for c in concepts if c.get("display_name")][:5]

        # Citation count
        citation_count = work.get("cited_by_count", 0)

        # Publication date
        pub_date = work.get("publication_date")
        published_at = None
        if pub_date:
            try:
                published_at = datetime.fromisoformat(pub_date).replace(tzinfo=UTC).isoformat()
            except (ValueError, TypeError):
                pass

        # Primary source/venue
        primary_loc = work.get("primary_location") or {}
        source = primary_loc.get("source") or {}
        source_name = source.get("display_name", "OpenAlex")

        articles.append({
            "title": title,
            "url": work_url,
            "source_name": f"OpenAlex ({source_name})",
            "source_domain": "openalex.org",
            "summary": abstract or f"Cited {citation_count} times. Topics: {', '.join(tags[:3])}.",
            "published_at": published_at,
            "language": "en",
            "category": tags[0] if tags else None,
            "raw_json": {
                "openalex_id": work.get("id"),
                "doi": doi,
                "authors": authors[:10],
                "concepts": tags,
                "citation_count": citation_count,
                "year": work.get("publication_year"),
                "source_name": source_name,
            },
        })

    logger.info("OpenAlex: %d works for search '%s'", len(articles), search)
    return articles


DEFAULT_SEARCHES = [
    "artificial intelligence",
    "machine learning",
    "cybersecurity",
    "natural language processing",
    "computer vision",
    "climate change technology",
    "semiconductor",
    "blockchain",
]


def fetch_all_openalex(
    searches: list[str] | None = None,
    max_per_search: int = 20,
    from_date: str | None = None,
) -> list[dict[str, Any]]:
    """Run multiple OpenAlex searches and merge results, deduplicated by URL."""
    if searches is None:
        searches = DEFAULT_SEARCHES

    seen_urls: set[str] = set()
    all_articles: list[dict[str, Any]] = []

    for s in searches:
        articles = fetch_openalex_works(
            search=s,
            per_page=max_per_search,
            from_publication_date=from_date,
        )
        for a in articles:
            if a["url"] not in seen_urls:
                seen_urls.add(a["url"])
                all_articles.append(a)
        time.sleep(0.2)  # OpenAlex is generous, but be polite

    logger.info("OpenAlex total: %d unique works", len(all_articles))
    return all_articles
