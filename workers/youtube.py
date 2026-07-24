"""YouTube Data API client — tech tutorials, conference talks, AI news.

Requires YOUTUBE_API_KEY env var. Free tier: 10,000 units/day.
Each search costs ~100 units. Good for finding "what to watch" recommendations.
"""

from __future__ import annotations

import logging
import os
import time
from datetime import datetime, timezone
from typing import Any
from urllib.parse import urlparse

import httpx

logger = logging.getLogger(__name__)

_API_BASE = "https://www.googleapis.com/youtube/v3"
_TIMEOUT = 15


def _extract_domain(url: str) -> str:
    try:
        return urlparse(url).netloc.replace("www.", "")
    except Exception:
        return ""


def _get_api_key() -> str:
    return os.environ.get("YOUTUBE_API_KEY", "")


def search_videos(
    query: str = "technology news",
    max_results: int = 20,
    order: str = "date",
    published_after: str | None = None,
) -> list[dict[str, Any]]:
    """Search YouTube videos.

    Args:
        query: Search query (e.g. "AI tutorial", "cybersecurity news").
        max_results: Max results (caps at 50).
        order: "date", "rating", "relevance", "title", "viewCount".
        published_after: ISO 8601 date (e.g. "2026-07-01T00:00:00Z").

    Returns:
        List of dicts with standardized article schema.
    """
    api_key = _get_api_key()
    if not api_key:
        logger.warning("YOUTUBE_API_KEY not set, skipping YouTube API")
        return []

    params: dict[str, Any] = {
        "part": "snippet",
        "q": query,
        "maxResults": min(max_results, 50),
        "order": order,
        "type": "video",
        "relevanceLanguage": "en",
        "key": api_key,
    }
    if published_after:
        params["publishedAfter"] = published_after

    try:
        resp = httpx.get(f"{_API_BASE}/search", params=params, timeout=_TIMEOUT)
        resp.raise_for_status()
        data = resp.json()
    except httpx.TimeoutException:
        logger.warning("YouTube API timed out for query: %s", query)
        return []
    except Exception:
        logger.exception("YouTube API request failed")
        return []

    items = data.get("items", [])
    articles: list[dict[str, Any]] = []

    for item in items:
        snippet = item.get("snippet", {})
        video_id = item.get("id", {}).get("videoId", "")
        if not video_id:
            continue

        url = f"https://www.youtube.com/watch?v={video_id}"
        title = snippet.get("title", "").strip()
        if not title:
            continue

        description = snippet.get("description", "") or ""
        channel = snippet.get("channelTitle", "")
        published_at_raw = snippet.get("publishedAt", "")

        published_at = None
        if published_at_raw:
            try:
                published_at = datetime.fromisoformat(published_at_raw.replace("Z", "+00:00")).isoformat()
            except (ValueError, TypeError):
                pass

        summary_parts = []
        if channel:
            summary_parts.append(f"Channel: {channel}")
        if description:
            summary_parts.append(description[:200])
        summary = " | ".join(summary_parts) if summary_parts else title

        articles.append({
            "title": title,
            "url": url,
            "source_name": f"YouTube ({channel})" if channel else "YouTube",
            "source_domain": "youtube.com",
            "summary": summary,
            "published_at": published_at,
            "language": "en",
            "category": "video",
            "raw_json": item,
        })

    logger.info("YouTube: %d videos for query '%s'", len(articles), query)
    return articles


DEFAULT_QUERIES = [
    "AI news this week",
    "cybersecurity news",
    "open source projects",
    "machine learning tutorial",
    "tech startup news",
    "semiconductor industry",
    "cloud computing news",
    "Cambodia technology",
]


def fetch_all_youtube(
    queries: list[str] | None = None,
) -> list[dict[str, Any]]:
    """Run multiple YouTube searches, deduplicated by video ID."""
    if queries is None:
        queries = DEFAULT_QUERIES

    api_key = _get_api_key()
    if not api_key:
        logger.warning("YOUTUBE_API_KEY not set, skipping YouTube API")
        return []

    seen_ids: set[str] = set()
    all_articles: list[dict[str, Any]] = []

    for q in queries:
        articles = search_videos(query=q, max_results=10)
        for a in articles:
            video_id = a["url"].split("v=")[-1].split("&")[0]
            if video_id not in seen_ids:
                seen_ids.add(video_id)
                all_articles.append(a)
        time.sleep(0.5)

    logger.info("YouTube total: %d unique videos", len(all_articles))
    return all_articles
