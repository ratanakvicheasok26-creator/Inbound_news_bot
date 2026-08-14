"""Firecrawl client — crawl entire domains and extract structured Markdown.

Free tier: 500 free page credits/month.
Requires FIRECRAWL_API_KEY env var.
"""

from __future__ import annotations

import logging
import os
import time
from typing import Any
from urllib.parse import urlparse

import httpx

logger = logging.getLogger(__name__)

_BASE = "https://api.firecrawl.dev/v1"
_TIMEOUT = 60


def _extract_domain(url: str) -> str:
    try:
        return urlparse(url).netloc.replace("www.", "")
    except Exception:
        return ""


def crawl_url(
    url: str,
    limit: int = 10,
    scrape_options: dict | None = None,
) -> list[dict[str, Any]]:
    """Crawl a single URL and extract Markdown content.

    Args:
        url: Starting URL to crawl.
        limit: Max pages to crawl.
        scrape_options: Optional scrape config (formats, etc.).

    Returns:
        List of dicts with standardized article schema.
    """
    api_key = os.environ.get("FIRECRAWL_API_KEY", "").strip()
    if not api_key:
        logger.warning("FIRECRAWL_API_KEY not set — skipping Firecrawl")
        return []

    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
    }

    payload: dict[str, Any] = {
        "url": url,
        "limit": min(limit, 50),
    }
    if scrape_options:
        payload["scrapeOptions"] = scrape_options
    else:
        payload["scrapeOptions"] = {
            "formats": ["markdown"],
            "onlyMainContent": True,
        }

    try:
        # Start crawl job
        resp = httpx.post(f"{_BASE}/crawl", json=payload, headers=headers, timeout=30)
        resp.raise_for_status()
        data = resp.json()
    except httpx.TimeoutException:
        logger.warning("Firecrawl crawl start timed out for: %s", url)
        return []
    except Exception:
        logger.exception("Firecrawl crawl request failed")
        return []

    job_id = data.get("id")
    if not job_id:
        logger.warning("Firecrawl returned no job ID")
        return []

    # Poll for completion (max 5 minutes)
    for _ in range(30):
        time.sleep(10)
        try:
            poll_resp = httpx.get(
                f"{_BASE}/crawl/{job_id}",
                headers=headers,
                timeout=30,
            )
            poll_resp.raise_for_status()
            poll_data = poll_resp.json()
        except Exception:
            continue

        status = poll_data.get("status")
        if status == "completed":
            return _parse_crawl_results(poll_data)
        elif status == "failed":
            logger.warning("Firecrawl crawl failed for: %s", url)
            return []

    logger.warning("Firecrawl crawl timed out waiting for completion")
    return []


def scrape_url(
    url: str,
    formats: list[str] | None = None,
) -> dict[str, Any] | None:
    """Scrape a single URL (no crawling, just one page).

    Returns a dict matching the standardized article schema, or None.
    """
    api_key = os.environ.get("FIRECRAWL_API_KEY", "").strip()
    if not api_key:
        return None

    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
    }

    payload = {
        "url": url,
        "formats": formats or ["markdown"],
        "onlyMainContent": True,
    }

    try:
        resp = httpx.post(f"{_BASE}/scrape", json=payload, headers=headers, timeout=30)
        resp.raise_for_status()
        data = resp.json().get("data", {})
    except Exception:
        logger.exception("Firecrawl scrape failed for: %s", url)
        return None

    markdown = data.get("markdown", "")
    if not markdown:
        return None

    title = data.get("metadata", {}).get("title", "")
    description = data.get("metadata", {}).get("description", "")
    domain = _extract_domain(url)

    return {
        "title": title or f"Article from {domain}",
        "url": url,
        "source_name": f"Firecrawl ({domain})",
        "source_domain": domain,
        "summary": description or markdown[:300],
        "published_at": None,
        "language": "en",
        "category": None,
        "raw_json": {
            "markdown": markdown[:5000],
            "metadata": data.get("metadata", {}),
        },
    }


def _parse_crawl_results(data: dict) -> list[dict[str, Any]]:
    """Parse Firecrawl crawl results into standardized article dicts."""
    articles: list[dict[str, Any]] = []

    for item in data.get("data", []):
        url = item.get("metadata", {}).get("sourceURL", "") or item.get("url", "")
        if not url:
            continue

        markdown = item.get("markdown", "")
        if not markdown:
            continue

        title = item.get("metadata", {}).get("title", "")
        description = item.get("metadata", {}).get("description", "")
        domain = _extract_domain(url)

        articles.append({
            "title": title or f"Page from {domain}",
            "url": url,
            "source_name": f"Firecrawl ({domain})",
            "source_domain": domain,
            "summary": description or markdown[:300],
            "published_at": None,
            "language": "en",
            "category": None,
            "raw_json": {
                "markdown": markdown[:5000],
                "metadata": item.get("metadata", {}),
            },
        })

    logger.info("Firecrawl: %d pages extracted", len(articles))
    return articles


def crawl_and_extract(
    urls: list[str],
    pages_per_domain: int = 5,
) -> list[dict[str, Any]]:
    """Crawl multiple domains and extract articles.

    Args:
        urls: Starting URLs (one per domain).
        pages_per_domain: Max pages to crawl per domain.

    Returns:
        List of extracted articles, deduplicated by URL.
    """
    seen_urls: set[str] = set()
    all_articles: list[dict[str, Any]] = []

    for url in urls:
        articles = crawl_url(url, limit=pages_per_domain)
        for a in articles:
            if a["url"] not in seen_urls:
                seen_urls.add(a["url"])
                all_articles.append(a)
        time.sleep(2)

    logger.info("Firecrawl total: %d unique pages from %d domains", len(all_articles), len(urls))
    return all_articles
