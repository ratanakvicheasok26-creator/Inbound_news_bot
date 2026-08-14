"""Stack Exchange API client — trending programming questions.

Free, no API key required (300 requests/day). Good for developer audience.
"""

from __future__ import annotations

import logging
import time
from datetime import UTC, datetime
from typing import Any
from urllib.parse import urlparse

import httpx

logger = logging.getLogger(__name__)

_API_BASE = "https://api.stackexchange.com/2.3"
_TIMEOUT = 15


def _extract_domain(url: str) -> str:
    try:
        return urlparse(url).netloc.replace("www.", "")
    except Exception:
        return ""


def fetch_trending_questions(
    site: str = "stackoverflow",
    tagged: str = "",
    sort: str = "votes",
    page_size: int = 30,
    days: int = 7,
) -> list[dict[str, Any]]:
    """Fetch trending Stack Overflow questions.

    Args:
        site: "stackoverflow", "superuser", "serverfault", etc.
        tagged: Semicolon-separated tags (e.g. "python;machine-learning").
        sort: "votes", "creation", "activity".
        page_size: Max results (caps at 100).
        days: Only questions from last N days.

    Returns:
        List of dicts with standardized article schema.
    """
    params: dict[str, Any] = {
        "order": "desc",
        "sort": sort,
        "site": site,
        "pagesize": min(page_size, 100),
        "filter": "withbody",
    }
    if tagged:
        params["tagged"] = tagged

    try:
        resp = httpx.get(f"{_API_BASE}/questions", params=params, timeout=_TIMEOUT)
        resp.raise_for_status()
        data = resp.json()
    except httpx.TimeoutException:
        logger.warning("Stack Exchange API timed out for site: %s", site)
        return []
    except Exception:
        logger.exception("Stack Exchange API request failed")
        return []

    items = data.get("items", [])
    articles: list[dict[str, Any]] = []

    for item in items:
        question_id = item.get("question_id", "")
        title = item.get("title", "").strip()
        if not title or not question_id:
            continue

        url = item.get("link", f"https://{site}.com/q/{question_id}")
        tags = item.get("tags", []) or []
        score = item.get("score", 0)
        answer_count = item.get("answer_count", 0)
        view_count = item.get("view_count", 0)

        summary_parts = [f"Score: {score} | Answers: {answer_count} | Views: {view_count:,}"]
        if tags:
            summary_parts.append(f"Tags: {', '.join(tags[:5])}")
        summary = " | ".join(summary_parts)

        published_at = None
        creation_date = item.get("creation_date")
        if creation_date:
            try:
                published_at = datetime.fromtimestamp(creation_date, tz=UTC).isoformat()
            except (ValueError, TypeError, OSError):
                pass

        articles.append({
            "title": title,
            "url": url,
            "source_name": f"Stack Overflow ({', '.join(tags[:2])})" if tags else "Stack Overflow",
            "source_domain": site + ".com",
            "summary": summary,
            "published_at": published_at,
            "language": "en",
            "category": tags[0] if tags else "programming",
            "raw_json": item,
        })

    logger.info("Stack Exchange: %d questions for site '%s'", len(articles), site)
    return articles


DEFAULT_TAGS = [
    "python",
    "javascript",
    "machine-learning",
    "artificial-intelligence",
    "cybersecurity",
    "rust",
    "docker",
    "kubernetes",
    "react",
    "linux",
]


def fetch_all_stackexchange(
    tags: list[str] | None = None,
) -> list[dict[str, Any]]:
    """Fetch trending questions across multiple tags, deduplicated by URL."""
    if tags is None:
        tags = DEFAULT_TAGS

    seen_urls: set[str] = set()
    all_articles: list[dict[str, Any]] = []

    for tag in tags:
        articles = fetch_trending_questions(tagged=tag, sort="votes", page_size=10)
        for a in articles:
            if a["url"] not in seen_urls:
                seen_urls.add(a["url"])
                all_articles.append(a)
        time.sleep(0.5)

    logger.info("Stack Exchange total: %d unique questions", len(all_articles))
    return all_articles
