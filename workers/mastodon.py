"""Mastodon public timeline client — open-source social media.

Free, no API key required for public timelines. Tech community is active on
instances like tech.social, mastodon.social, hachyderm.io, etc.
"""

from __future__ import annotations

import logging
import time
from datetime import datetime
from typing import Any
from urllib.parse import urlparse

import httpx

logger = logging.getLogger(__name__)

_TIMEOUT = 15

DEFAULT_INSTANCES = [
    "https://tech.social",
    "https://mastodon.social",
    "https://hachyderm.io",
    "https://fosstodon.org",
    "https://chaos.social",
]


def _extract_domain(url: str) -> str:
    try:
        return urlparse(url).netloc.replace("www.", "")
    except Exception:
        return ""


def fetch_instance_timeline(
    instance_url: str = "https://tech.social",
    limit: int = 30,
    local: bool = True,
) -> list[dict[str, Any]]:
    """Fetch public timeline from a Mastodon instance.

    Args:
        instance_url: Full instance URL (e.g. "https://tech.social").
        limit: Max posts (caps at 40).
        local: If True, only local timeline. If False, federated timeline.

    Returns:
        List of dicts with standardized article schema.
    """
    endpoint = "/api/v1/timelines/public"
    if local:
        endpoint = "/api/v1/timelines/tag/technology"

    url = f"{instance_url.rstrip('/')}{endpoint}"
    params = {"limit": min(limit, 40)}

    try:
        resp = httpx.get(url, params=params, timeout=_TIMEOUT, follow_redirects=True)
        resp.raise_for_status()
        data = resp.json()
    except httpx.TimeoutException:
        logger.warning("Mastodon timed out for instance: %s", instance_url)
        return []
    except Exception:
        logger.exception("Mastodon request failed for %s", instance_url)
        return []

    if not isinstance(data, list):
        logger.warning("Mastodon returned non-list for %s", instance_url)
        return []

    instance_domain = _extract_domain(instance_url)
    articles: list[dict[str, Any]] = []

    for post in data:
        # Skip boosts (reblogs) to avoid duplicates
        if post.get("reblog"):
            continue

        post_url = post.get("url", "")
        if not post_url:
            continue

        # Strip HTML from content
        content = post.get("content", "") or ""
        # Simple HTML tag removal
        import re
        clean_text = re.sub(r"<[^>]+>", "", content).strip()
        if not clean_text:
            continue

        # Use first 300 chars as summary
        summary = clean_text[:300]
        if len(clean_text) > 300:
            summary += "..."

        account = post.get("account", {})
        display_name = account.get("display_name", "") or account.get("acct", "")

        published_at = None
        created = post.get("created_at")
        if created:
            try:
                published_at = datetime.fromisoformat(created.replace("Z", "+00:00")).isoformat()
            except (ValueError, TypeError):
                pass

        favourites = post.get("favourites_count", 0)
        reblogs = post.get("reblogs_count", 0)

        articles.append({
            "title": f"@{display_name} on Mastodon" if display_name else "Mastodon post",
            "url": post_url,
            "source_name": f"Mastodon ({instance_domain})",
            "source_domain": instance_domain,
            "summary": summary,
            "published_at": published_at,
            "language": "en",
            "category": "social",
            "raw_json": post,
        })

    logger.info("Mastodon (%s): %d posts", instance_domain, len(articles))
    return articles


def fetch_all_mastodon(
    instances: list[str] | None = None,
    limit_per_instance: int = 20,
) -> list[dict[str, Any]]:
    """Fetch posts from multiple Mastodon instances, deduplicated by URL."""
    if instances is None:
        instances = DEFAULT_INSTANCES

    seen_urls: set[str] = set()
    all_articles: list[dict[str, Any]] = []

    for instance in instances:
        articles = fetch_instance_timeline(instance_url=instance, limit=limit_per_instance)
        for a in articles:
            if a["url"] not in seen_urls:
                seen_urls.add(a["url"])
                all_articles.append(a)
        time.sleep(0.5)

    logger.info("Mastodon total: %d unique posts", len(all_articles))
    return all_articles
