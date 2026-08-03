"""Build Inbound Reports website URLs for Telegram posts.

Telegram CTAs should send readers to the website first. Original source URLs
are available on the story page — not as the primary Telegram button.

When SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY are set, clusters are published
as stories so we can link to /story/{id}. Otherwise we fall back to /search?q=.
"""

from __future__ import annotations

import logging
import os
from typing import TYPE_CHECKING
from urllib.parse import quote, urlparse

if TYPE_CHECKING:
    from newsbot.feeds import Entry

logger = logging.getLogger(__name__)

_DEFAULT_WEBSITE = "https://inbound-news-web.vercel.app"


def website_base_url() -> str:
    return os.environ.get("WEBSITE_BASE_URL", _DEFAULT_WEBSITE).strip().rstrip("/") or _DEFAULT_WEBSITE


def search_url(title: str) -> str:
    q = quote((title or "").strip() or "tech news", safe="")
    return f"{website_base_url()}/search?q={q}"


def story_url(story_id: str) -> str:
    return f"{website_base_url()}/story/{story_id}"


def reader_url(*, title: str, story_id: str | None = None) -> str:
    """Preferred URL for Telegram CTAs."""
    if story_id:
        return story_url(story_id)
    return search_url(title)


def _domain(url: str) -> str | None:
    try:
        host = urlparse(url).netloc.lower()
        if host.startswith("www."):
            host = host[4:]
        return host or None
    except Exception:
        return None


def _supabase_ready() -> bool:
    return bool(
        os.environ.get("SUPABASE_URL", "").strip()
        and os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "").strip()
    )


def publish_cluster_story(
    cluster: list[Entry],
    *,
    title: str,
    summary: str,
    category: str | None = None,
) -> str | None:
    """Insert articles + story into Supabase. Returns story id or None."""
    if not cluster or not _supabase_ready():
        return None

    try:
        from workers.db import get_supabase

        supabase = get_supabase()
    except Exception as exc:
        logger.warning("Website publish skipped — Supabase unavailable: %s", exc)
        return None

    article_ids: list[str] = []
    try:
        for entry in cluster:
            row = {
                "title": entry.title or title,
                "summary": (entry.summary or "")[:2000],
                "url": entry.link,
                "source_name": entry.source_name or "",
                "source_domain": _domain(entry.link),
                "category": category,
                "language": "en",
                "image_url": getattr(entry, "image_url", None),
            }
            result = (
                supabase.table("articles")
                .upsert(row, on_conflict="url", ignore_duplicates=False)
                .execute()
            )
            data = result.data or []
            if data and data[0].get("id"):
                article_ids.append(data[0]["id"])
            else:
                # Upsert with ignore may return empty — fetch by url
                existing = (
                    supabase.table("articles")
                    .select("id")
                    .eq("url", entry.link)
                    .limit(1)
                    .execute()
                )
                rows = existing.data or []
                if rows:
                    article_ids.append(rows[0]["id"])

        if not article_ids:
            logger.warning("Website publish: no article ids for '%s'", title[:80])
            return None

        story_row = {
            "title": title,
            "summary_en": summary or "",
            "source_count": max(len(cluster), 1),
            "category": category,
            "tags": [],
        }
        # Prefer an existing image from the cluster
        for entry in cluster:
            img = getattr(entry, "image_url", None)
            if img:
                story_row["image_url"] = img
                break

        story_result = supabase.table("stories").insert(story_row).execute()
        story_data = story_result.data or []
        if not story_data:
            logger.warning("Website publish: story insert returned empty for '%s'", title[:80])
            return None
        story_id = story_data[0]["id"]

        for art_id, entry in zip(article_ids, cluster):
            supabase.table("story_sources").upsert(
                {
                    "story_id": story_id,
                    "article_id": art_id,
                    "source_name": entry.source_name or "",
                    "source_url": entry.link,
                },
                on_conflict="article_id",
            ).execute()

        logger.info("Published Telegram story to website id=%s title=%r", story_id, title[:80])
        return story_id
    except Exception as exc:
        logger.warning("Website publish failed for '%s': %s", title[:80], exc)
        return None
