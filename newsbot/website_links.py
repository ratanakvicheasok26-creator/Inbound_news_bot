"""Build Inbound Reports website URLs for Telegram posts.

Telegram CTAs should send readers to the website first. Original source URLs
are available on the story page — not as the primary Telegram button.

Preferred destinations:
  1. /story/{id} when we can publish/attach a complete story
  2. /brief/YYYY-MM-DD (today's brief) — habit destination, not empty search

When SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY are set, clusters are published
(or attached to an existing worker story) so deep links work.
"""

from __future__ import annotations

import logging
import os
from datetime import datetime
from typing import TYPE_CHECKING
from urllib.parse import quote, urlparse
from zoneinfo import ZoneInfo

if TYPE_CHECKING:
    from newsbot.feeds import Entry

logger = logging.getLogger(__name__)

_DEFAULT_WEBSITE = "https://inbound-news-web.vercel.app"
_TZ = ZoneInfo("Asia/Phnom_Penh")


def website_base_url() -> str:
    return os.environ.get("WEBSITE_BASE_URL", _DEFAULT_WEBSITE).strip().rstrip("/") or _DEFAULT_WEBSITE


def brief_date_str(when: datetime | None = None) -> str:
    dt = when or datetime.now(_TZ)
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=_TZ)
    return dt.astimezone(_TZ).strftime("%Y-%m-%d")


def brief_url(when: datetime | None = None) -> str:
    """Recurring daily brief — primary habit URL for digests."""
    return f"{website_base_url()}/brief/{brief_date_str(when)}"


def search_url(title: str) -> str:
    q = quote((title or "").strip() or "tech news", safe="")
    return f"{website_base_url()}/search?q={q}"


def story_url(story_id: str) -> str:
    return f"{website_base_url()}/story/{story_id}"


def reader_url(*, title: str, story_id: str | None = None) -> str:
    """Preferred URL for Telegram CTAs. Prefer story, else today's brief."""
    if story_id:
        return story_url(story_id)
    return brief_url()


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


def _normalize_category(
    raw: str | None,
    title: str,
    summary: str,
    source_domain: str | None,
) -> str | None:
    try:
        from workers.categories import normalize_category

        return normalize_category(raw, title, summary, source_domain)
    except Exception:
        return raw


def _attach_sources(supabase, story_id: str, article_ids: list[str], cluster: list[Entry]) -> None:
    """Link articles to a story. Uses plain insert; ignores duplicate rows."""
    for art_id, entry in zip(article_ids, cluster):
        try:
            supabase.table("story_sources").insert(
                {
                    "story_id": story_id,
                    "article_id": art_id,
                    "source_name": entry.source_name or "",
                    "source_url": entry.link,
                }
            ).execute()
        except Exception as exc:
            # Duplicate (story_id, article_id) or race — already attached is fine
            logger.debug("story_sources attach skip for %s: %s", art_id, exc)


def _find_existing_story_id(supabase, article_ids: list[str]) -> str | None:
    """Reuse a worker-created story that already covers any of these articles."""
    if not article_ids:
        return None
    try:
        result = (
            supabase.table("story_sources")
            .select("story_id")
            .in_("article_id", article_ids)
            .limit(1)
            .execute()
        )
        rows = result.data or []
        if rows and rows[0].get("story_id"):
            return rows[0]["story_id"]
    except Exception as exc:
        logger.debug("Existing story lookup failed: %s", exc)
    return None


def publish_cluster_story(
    cluster: list[Entry],
    *,
    title: str,
    summary: str,
    category: str | None = None,
    language: str = "en",
) -> str | None:
    """Upsert articles, attach/create story. Returns story id or None."""
    if not cluster or not _supabase_ready():
        return None

    try:
        from workers.db import get_supabase

        supabase = get_supabase()
    except Exception as exc:
        logger.warning("Website publish skipped — Supabase unavailable: %s", exc)
        return None

    try:
        article_ids: list[str] = []
        for entry in cluster:
            domain = _domain(entry.link)
            cat = _normalize_category(category, entry.title or title, entry.summary or summary, domain)
            row = {
                "title": entry.title or title,
                "summary": (entry.summary or "")[:2000],
                "url": entry.link,
                "source_name": entry.source_name or "",
                "source_domain": domain,
                "category": cat,
                "language": language,
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

        story_id = _find_existing_story_id(supabase, article_ids)
        if story_id:
            _attach_sources(supabase, story_id, article_ids, cluster)
            logger.info("Attached Telegram cluster to existing story id=%s", story_id)
            return story_id

        primary_domain = _domain(cluster[0].link) if cluster else None
        cat = _normalize_category(category, title, summary, primary_domain)
        story_row: dict = {
            "title": title,
            "summary_en": summary or "",
            "source_count": max(len(cluster), 1),
            "category": cat,
            "tags": [],
        }
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
        _attach_sources(supabase, story_id, article_ids, cluster)

        logger.info("Published Telegram story to website id=%s title=%r", story_id, title[:80])
        return story_id
    except Exception as exc:
        logger.warning("Website publish failed for '%s': %s", title[:80], exc)
        return None
