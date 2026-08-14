"""Lobste.rs client — strictly moderated, invite-only deep tech community.

100% free, no API key required. Just append .json to any URL.
"""

from __future__ import annotations

import logging
import time
from datetime import datetime
from typing import Any
from urllib.parse import urlparse

import httpx

logger = logging.getLogger(__name__)

_BASE = "https://lobste.rs"
_TIMEOUT = 15


def _extract_domain(url: str) -> str:
    try:
        return urlparse(url).netloc.replace("www.", "")
    except Exception:
        return ""


def fetch_lobsters(
    tag: str | None = None,
    count: int = 50,
) -> list[dict[str, Any]]:
    """Fetch stories from Lobste.rs JSON API.

    Args:
        tag: Optional tag filter (e.g. "rust", "python", "security").
        count: Max stories to return (API default ~25 per page).

    Returns:
        List of dicts with standardized article schema.
    """
    if tag:
        url = f"{_BASE}/t/{tag}.json"
    else:
        url = f"{_BASE}/hottest.json"

    try:
        resp = httpx.get(url, timeout=_TIMEOUT, follow_redirects=True,
                         headers={"Accept": "application/json"})
        resp.raise_for_status()
        stories = resp.json()
    except httpx.TimeoutException:
        logger.warning("Lobste.rs timed out (tag=%s)", tag or "all")
        return []
    except httpx.HTTPStatusError as exc:
        logger.warning("Lobste.rs HTTP %s (tag=%s)", exc.response.status_code, tag or "all")
        return []
    except Exception:
        logger.exception("Lobste.rs request failed")
        return []

    articles: list[dict[str, Any]] = []
    for story in stories[:count]:
        story_url = story.get("url") or story.get("comments_url", "")
        if not story_url:
            continue

        title = story.get("title", "").strip()
        if not title:
            continue

        tags = story.get("tags", []) or []
        author = story.get("submitter_user", "")
        if isinstance(author, dict):
            username = (author.get("username") or "").strip()
        else:
            username = str(author or "").strip()

        # Lobste.rs timestamps are ISO 8601
        created_at = story.get("created_at")
        published_at = None
        if created_at:
            try:
                published_at = datetime.fromisoformat(created_at.replace("Z", "+00:00")).isoformat()
            except (ValueError, TypeError):
                pass

        desc = (
            (story.get("description_plain") or "")
            or (story.get("description") or "")
        ).strip()
        tag_str = ", ".join(tags) if tags else "tech"
        if desc:
            summary = desc[:500]
        else:
            bits = [title]
            bits.append(f"discussed on Lobste.rs ({tag_str})")
            if username:
                bits.append(f"submitted by {username}")
            summary = " — ".join(bits) + "."

        articles.append({
            "title": title,
            "url": story_url,
            "source_name": "Lobste.rs",
            "source_domain": _extract_domain(story_url),
            "summary": summary,
            "published_at": published_at,
            "language": "en",
            "category": tags[0] if tags else None,
            "raw_json": story,
        })

    logger.info("Lobste.rs: %d stories (tag=%s)", len(articles), tag or "all")
    return articles


def fetch_all_lobsters(
    tags: list[str] | None = None,
) -> list[dict[str, Any]]:
    """Fetch Lobste.rs stories across multiple tags, deduplicated by URL."""
    if tags is None:
        tags = [None, "rust", "python", "security", "ai", "compsci"]  # None = hottest

    seen_urls: set[str] = set()
    all_articles: list[dict[str, Any]] = []

    for tag in tags:
        articles = fetch_lobsters(tag=tag)
        for a in articles:
            if a["url"] not in seen_urls:
                seen_urls.add(a["url"])
                all_articles.append(a)
        time.sleep(0.3)

    logger.info("Lobste.rs total: %d unique articles", len(all_articles))
    return all_articles
