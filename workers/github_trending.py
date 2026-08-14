"""GitHub trending repos client — tracks repos gaining stars rapidly.

Uses the unofficial GitHub Trending page + official Search API.
"""

from __future__ import annotations

import logging
import time
from datetime import UTC, datetime, timedelta
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


def fetch_github_trending(
    language: str = "",
    since: str = "weekly",
    spoken_language: str = "",
) -> list[dict[str, Any]]:
    """Fetch trending repos by scraping the unofficial GitHub trending page.

    Args:
        language: Filter by language (e.g. "python", "rust", "go").
        since: "daily", "weekly", or "monthly".
        spoken_language: Filter by spoken language (e.g. "en").

    Returns:
        List of dicts with standardized article schema.
    """
    # gitterapp unofficial trending API is often down (404); prefer Search API.
    # Keep a short probe so if it returns, we still use richer trending fields.
    url = "https://api.gitterapp.com/repositories"
    params: dict[str, str] = {"since": since}
    if language:
        params["language"] = language
    if spoken_language:
        params["spoken_language_code"] = spoken_language

    try:
        resp = httpx.get(url, params=params, timeout=5, follow_redirects=True)
        if resp.status_code != 200:
            return _fetch_via_search(language=language, since=since)
        repos = resp.json()
        if not isinstance(repos, list) or not repos:
            return _fetch_via_search(language=language, since=since)
    except httpx.TimeoutException:
        logger.debug("GitHub trending probe timed out — using Search API")
        return _fetch_via_search(language=language, since=since)
    except Exception:
        return _fetch_via_search(language=language, since=since)

    articles: list[dict[str, Any]] = []

    for repo in repos[:30]:
        repo_url = repo.get("url", "") or repo.get("html_url", "")
        if not repo_url:
            continue

        name = repo.get("name", "")
        author = repo.get("author", "")
        description = repo.get("description", "") or ""
        stars = repo.get("stars", 0)
        forks = repo.get("forks", 0)
        language = repo.get("language", "")
        topics = repo.get("topics", []) or []
        current_period_stars = repo.get("currentPeriodStars", 0)

        # Build a summary
        parts = [f"⭐ {stars:,} stars (+{current_period_stars:,} this {since})"]
        if language:
            parts.append(f"Language: {language}")
        if description:
            parts.append(description[:200])
        summary = " | ".join(parts)

        # Approximate publish date
        published_at = None
        created_at = repo.get("createdAt")
        if created_at:
            try:
                published_at = datetime.fromisoformat(created_at.replace("Z", "+00:00")).isoformat()
            except (ValueError, TypeError):
                pass

        articles.append({
            "title": f"{author}/{name}" if author else name,
            "url": repo_url,
            "source_name": "GitHub Trending",
            "source_domain": "github.com",
            "summary": summary,
            "published_at": published_at,
            "language": "en",
            "category": language or "open source",
            "raw_json": repo,
        })

    logger.info("GitHub Trending: %d repos (language=%s, since=%s)", len(articles), language or "all", since)
    return articles


def _fetch_via_search(language: str = "", since: str = "weekly") -> list[dict[str, Any]]:
    """Fallback: use GitHub Search API for recently created/popular repos."""
    # Calculate date threshold
    days_map = {"daily": 1, "weekly": 7, "monthly": 30}
    days = days_map.get(since, 7)
    date_threshold = (datetime.now(UTC) - timedelta(days=days)).strftime("%Y-%m-%d")

    query_parts = [f"created:>{date_threshold}", "stars:>50"]
    if language:
        query_parts.append(f"language:{language}")
    query = " ".join(query_parts)

    params = {
        "q": query,
        "sort": "stars",
        "order": "desc",
        "per_page": 30,
    }

    headers = {"Accept": "application/vnd.github.v3+json"}
    token = _get_github_token()
    if token:
        headers["Authorization"] = f"token {token}"

    try:
        resp = httpx.get(_SEARCH_BASE, params=params, headers=headers, timeout=_TIMEOUT)
        resp.raise_for_status()
        data = resp.json()
    except Exception:
        logger.exception("GitHub Search API failed")
        return []

    articles: list[dict[str, Any]] = []

    for repo in data.get("items", [])[:30]:
        repo_url = repo.get("html_url", "")
        if not repo_url:
            continue

        name = repo.get("full_name", repo.get("name", ""))
        description = repo.get("description", "") or ""
        stars = repo.get("stargazers_count", 0)
        lang = repo.get("language", "")
        topics = repo.get("topics", []) or []

        summary_parts = [f"⭐ {stars:,} stars"]
        if lang:
            summary_parts.append(f"Language: {lang}")
        if description:
            summary_parts.append(description[:200])

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
            "source_name": "GitHub Trending",
            "source_domain": "github.com",
            "summary": " | ".join(summary_parts),
            "published_at": published_at,
            "language": "en",
            "category": lang or "open source",
            "raw_json": repo,
        })

    logger.info("GitHub Search: %d repos", len(articles))
    return articles


def _get_github_token() -> str:
    import os
    return os.environ.get("GITHUB_TOKEN", "").strip()


def fetch_all_github_trending(
    languages: list[str] | None = None,
    since: str = "weekly",
) -> list[dict[str, Any]]:
    """Fetch trending repos across multiple languages, deduplicated by URL."""
    if languages is None:
        languages = ["", "python", "javascript", "rust", "go", "typescript"]

    seen_urls: set[str] = set()
    all_articles: list[dict[str, Any]] = []

    for lang in languages:
        articles = fetch_github_trending(language=lang, since=since)
        for a in articles:
            if a["url"] not in seen_urls:
                seen_urls.add(a["url"])
                all_articles.append(a)
        time.sleep(0.5)

    logger.info("GitHub Trending total: %d unique repos", len(all_articles))
    return all_articles
