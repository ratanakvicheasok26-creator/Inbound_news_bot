"""arXiv client — Cornell's repository of academic preprints.

100% free, no API key required. REST API for metadata + abstracts.
"""

from __future__ import annotations

import logging
import re
import time
import xml.etree.ElementTree as ET
from datetime import datetime
from typing import Any
from urllib.parse import urlparse

import httpx

logger = logging.getLogger(__name__)

_BASE = "http://export.arxiv.org/api/query"
_TIMEOUT = 20

# arXiv category prefixes
CATEGORIES = {
    "ai": "cs.AI",
    "ml": "cs.LG",
    "security": "cs.CR",
    "cl": "cs.CL",
    "cv": "cs.CV",
    "robotics": "cs.RO",
    "graphics": "cs.GR",
    "databases": "cs.DB",
    "se": "cs.SE",
}


def _extract_domain(url: str) -> str:
    try:
        return urlparse(url).netloc.replace("www.", "")
    except Exception:
        return ""


def fetch_arxiv(
    query: str = "cat:cs.AI",
    max_results: int = 30,
    sort_by: str = "submittedDate",
    sort_order: str = "descending",
) -> list[dict[str, Any]]:
    """Fetch papers from arXiv REST API.

    Args:
        query: Search query (e.g. "cat:cs.AI", "all:transformers").
        max_results: Max papers to return.
        sort_by: "submittedDate", "relevance", or "lastUpdatedDate".
        sort_order: "ascending" or "descending".

    Returns:
        List of dicts with standardized article schema.
    """
    params = {
        "search_query": query,
        "start": 0,
        "max_results": min(max_results, 100),
        "sortBy": sort_by,
        "sortOrder": sort_order,
    }

    try:
        resp = httpx.get(_BASE, params=params, timeout=_TIMEOUT, follow_redirects=True)
        resp.raise_for_status()
    except httpx.TimeoutException:
        logger.warning("arXiv timed out for query: %s", query)
        return []
    except Exception:
        logger.exception("arXiv request failed")
        return []

    # Parse Atom XML
    ns = {"atom": "http://www.w3.org/2005/Atom", "arxiv": "http://arxiv.org/schemas/atom"}
    try:
        root = ET.fromstring(resp.text)
    except ET.ParseError:
        logger.warning("arXiv returned invalid XML")
        return []

    articles: list[dict[str, Any]] = []

    for entry in root.findall("atom:entry", ns):
        title_el = entry.find("atom:title", ns)
        title = (title_el.text or "").strip() if title_el is not None else ""
        title = re.sub(r"\s+", " ", title)
        if not title:
            continue

        # Get paper URL (prefer abstract page over PDF)
        paper_url = ""
        for link in entry.findall("atom:link", ns):
            if link.get("type") == "text/html":
                paper_url = link.get("href", "")
                break
        if not paper_url:
            id_el = entry.find("atom:id", ns)
            paper_url = id_el.text.strip() if id_el is not None else ""

        if not paper_url:
            continue

        # Summary/abstract
        summary_el = entry.find("atom:summary", ns)
        summary = (summary_el.text or "").strip() if summary_el is not None else ""
        summary = re.sub(r"\s+", " ", summary)[:500]

        # Authors
        authors = []
        for author_el in entry.findall("atom:author", ns):
            name_el = author_el.find("atom:name", ns)
            if name_el is not None and name_el.text:
                authors.append(name_el.text.strip())

        # Categories
        tags = []
        for cat_el in entry.findall("atom:category", ns):
            term = cat_el.get("term", "")
            if term:
                tags.append(term)

        # Published date
        published_el = entry.find("atom:published", ns)
        published_at = None
        if published_el is not None and published_el.text:
            try:
                dt = datetime.fromisoformat(published_el.text.replace("Z", "+00:00"))
                published_at = dt.isoformat()
            except (ValueError, TypeError):
                pass

        # Extract arXiv ID for unique identification
        arxiv_id = ""
        id_el = entry.find("atom:id", ns)
        if id_el is not None and id_el.text:
            arxiv_id = id_el.text.strip()

        articles.append({
            "title": title,
            "url": paper_url,
            "source_name": "arXiv",
            "source_domain": "arxiv.org",
            "summary": summary,
            "published_at": published_at,
            "language": "en",
            "category": tags[0] if tags else None,
            "raw_json": {
                "arxiv_id": arxiv_id,
                "authors": authors,
                "categories": tags,
            },
        })

    logger.info("arXiv: %d papers for query '%s'", len(articles), query)
    return articles


def fetch_all_arxiv(
    queries: list[str] | None = None,
    max_per_query: int = 20,
) -> list[dict[str, Any]]:
    """Run multiple arXiv queries and merge results, deduplicated by URL."""
    if queries is None:
        queries = [
            "cat:cs.AI",   # AI
            "cat:cs.LG",   # Machine Learning
            "cat:cs.CR",   # Security/Cryptography
            "cat:cs.CL",   # Computation and Language (NLP)
        ]

    seen_urls: set[str] = set()
    all_articles: list[dict[str, Any]] = []

    for q in queries:
        articles = fetch_arxiv(query=q, max_results=max_per_query)
        for a in articles:
            if a["url"] not in seen_urls:
                seen_urls.add(a["url"])
                all_articles.append(a)
        time.sleep(1)  # arXiv asks for 3s between requests; we do 1s

    logger.info("arXiv total: %d unique papers from %d queries", len(all_articles), len(queries))
    return all_articles
