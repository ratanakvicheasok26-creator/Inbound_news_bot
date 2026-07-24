"""GitHub REST API client — search repos by language, stars, creation date.

Free, no API key required (10 req/min). With token: 30 req/min.
More powerful than trending — can find new projects before they go viral.
"""

from __future__ import annotations

import logging
import os
import time
from datetime import datetime, timezone, timedelta
from typing import Any
from urllib.parse import urlparse

import httpx

logger = logging.getLogger(__name__)

_SEARCH_BASE = "https://api.github.com/search/repositories"
_TIMEOUT = 15


def _extract_domain(url: str) -> str:
    try:
        return urlparse(url).netloc.replace("www.", "")
    except Exception:
        return ""


def _get_token() -> str:
    return os.environ.get("GITHUB_TOKEN", "").strip()


def search_repos(
    query: str = "stars:>100",
    sort: str = "stars",
    order: str = "desc",
    per_page: int = 30,
) -> list[dict[str, Any]]:
    """Search GitHub repos via REST API.

    Args:
        query: GitHub search query (e.g. "language:python stars:>500 created:>2026-07-01").
        sort: "stars", "forks", "updated".
        order: "desc" or "asc".
        per_page: Max results (caps at 100).

    Returns:
        List of dicts with standardized article schema.
    """
    params = {
        "q": query,
        "sort": sort,
        "order": order,
        "per_page": min(per_page, 100),
    }

    headers = {"Accept": "application/vnd.github.v3+json"}
    token = _get_token()
    if token:
        headers["Authorization"] = f"token {token}"

    try:
        resp = httpx.get(_SEARCH_BASE, params=params, headers=headers, timeout=_TIMEOUT)
        resp.raise_for_status()
        data = resp.json()
    except httpx.TimeoutException:
        logger.warning("GitHub API timed out for query: %s", query)
        return []
    except Exception:
        logger.exception("GitHub API request failed")
        return []

    articles: list[dict[str, Any]] = []

    for repo in data.get("items", [])[:per_page]:
        repo_url = repo.get("html_url", "")
        if not repo_url:
            continue

        name = repo.get("full_name", repo.get("name", ""))
        description = repo.get("description", "") or ""
        stars = repo.get("stargazers_count", 0)
        lang = repo.get("language", "")
        topics = repo.get("topics", []) or []
        forks = repo.get("forks_count", 0)

        summary_parts = [f"⭐ {stars:,} stars"]
        if lang:
            summary_parts.append(f"Language: {lang}")
        if description:
            summary_parts.append(description[:200])
        summary = " | ".join(summary_parts)

        published_at = None
        created = repo.get("created_at")
        if created:
            try:
                published_at = datetime.fromisoformat(created.replace("Z", "+00:00")).isoformat()
            except (ValueError, TypeError):
                pass

        articles.append({
            "title": name,
            "url": repo_url,
            "source_name": "GitHub API",
            "source_domain": "github.com",
            "summary": summary,
            "published_at": published_at,
            "language": "en",
            "category": lang or "open source",
            "raw_json": repo,
        })

    logger.info("GitHub API: %d repos for query '%s'", len(articles), query)
    return articles


DEFAULT_QUERIES = [
    "stars:>500 created:>2026-07-17",
    "language:python stars:>200 created:>2026-07-17",
    "language:javascript stars:>200 created:>2026-07-17",
    "language:rust stars:>100 created:>2026-07-17",
    "language:go stars:>100 created:>2026-07-17",
    "language:typescript stars:>100 created:>2026-07-17",
    "topic:ai stars:>500",
    "topic:machine-learning stars:>300",
    "topic:cybersecurity stars:>200",
    "topic:llm stars:>300",
]


def fetch_all_github_api(
    queries: list[str] | None = None,
) -> list[dict[str, Any]]:
    """Run multiple GitHub searches, deduplicated by URL."""
    if queries is None:
        queries = DEFAULT_QUERIES

    seen_urls: set[str] = set()
    all_articles: list[dict[str, Any]] = []

    for q in queries:
        articles = search_repos(query=q, per_page=20)
        for a in articles:
            if a["url"] not in seen_urls:
                seen_urls.add(a["url"])
                all_articles.append(a)
        time.sleep(1.0)

    logger.info("GitHub API total: %d unique repos", len(all_articles))
    return all_articles
