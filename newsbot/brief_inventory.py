"""Supabase story pool for Telegram Daily Brief.

Website ingest (900+ RSS/API sources) writes ``stories`` / ``articles``.
Telegram Brief should read that pool instead of live-polling ~130 RSS feeds.
"""

from __future__ import annotations

import logging
import os
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from typing import Any
from zoneinfo import ZoneInfo

from newsbot.config import NEWS_CATEGORIES_SET, TECH_ONLY
from newsbot.feeds import Entry

logger = logging.getLogger(__name__)

STORY_BRIEF_PREFIX = "story:"
_STORY_FETCH_LIMIT = 24
_DEFAULT_TZ = ZoneInfo("Asia/Phnom_Penh")
_DEFAULT_HOURS: tuple[int, ...] = (6, 12, 18, 22)


def story_brief_id(story_id: str) -> str:
    """Stable briefed_ids key for a Supabase story UUID."""
    return f"{STORY_BRIEF_PREFIX}{story_id}"


def supabase_ready(environ: dict[str, str] | None = None) -> bool:
    env = environ if environ is not None else os.environ
    return bool(
        (env.get("SUPABASE_URL") or "").strip()
        and (env.get("SUPABASE_SERVICE_ROLE_KEY") or "").strip()
    )


def previous_brief_slot_start(
    now: datetime,
    hours: tuple[int, ...] | None = None,
    tz: ZoneInfo | None = None,
) -> datetime:
    """Start of the window for this Brief slot.

    During a scheduled Brief hour (e.g. 06:00–06:59), the window starts at the
    previous slot (6am → 22:00 yesterday). Otherwise it starts at the most
    recent past slot.
    """
    zone = tz or _DEFAULT_TZ
    slots = tuple(sorted(h for h in (hours or _DEFAULT_HOURS) if 0 <= h <= 23)) or _DEFAULT_HOURS
    if now.tzinfo is None:
        aware = now.replace(tzinfo=zone)
    else:
        aware = now.astimezone(zone)
    today = aware.date()

    def _at(day, hour: int) -> datetime:
        return datetime(day.year, day.month, day.day, hour, 0, tzinfo=zone)

    if aware.hour in slots:
        idx = slots.index(aware.hour)
        if idx == 0:
            return _at(today - timedelta(days=1), slots[-1])
        return _at(today, slots[idx - 1])

    for hour in reversed(slots):
        slot = _at(today, hour)
        if slot < aware:
            return slot
    return _at(today - timedelta(days=1), slots[-1])


@dataclass
class SiteBriefStory:
    """One website story ready to become a Telegram BatchedStory."""

    story_id: str
    title: str
    summary: str
    image_url: str | None = None
    entries: list[Entry] = field(default_factory=list)

    @property
    def brief_id(self) -> str:
        return story_brief_id(self.story_id)

    @property
    def entry_ids(self) -> set[str]:
        ids = {self.brief_id}
        ids.update(e.id for e in self.entries if e.id)
        return ids

    @property
    def entry_titles(self) -> set[str]:
        titles = {self.title} if self.title else set()
        titles.update(e.title for e in self.entries if e.title)
        return titles


def is_site_story_briefed(
    story_id: str,
    article_ids: set[str],
    briefed_ids: set[str],
) -> bool:
    if story_brief_id(story_id) in briefed_ids:
        return True
    return bool(article_ids and article_ids & briefed_ids)


def assemble_site_stories(
    story_rows: list[dict[str, Any]],
    source_rows: list[dict[str, Any]],
    article_rows: list[dict[str, Any]],
    briefed_ids: set[str],
) -> list[SiteBriefStory]:
    """Join story/source/article rows and drop already-briefed stories."""
    articles_by_id = {str(a.get("id") or ""): a for a in article_rows if a.get("id")}
    sources_by_story: dict[str, list[dict[str, Any]]] = {}
    for link in source_rows:
        sid = str(link.get("story_id") or "")
        if not sid:
            continue
        sources_by_story.setdefault(sid, []).append(link)

    result: list[SiteBriefStory] = []
    for row in story_rows:
        story_id = str(row.get("id") or "")
        title = (row.get("title") or "").strip()
        if not story_id or not title:
            continue
        links = sources_by_story.get(story_id, [])
        article_ids = {str(x.get("article_id") or "") for x in links if x.get("article_id")}
        if is_site_story_briefed(story_id, article_ids, briefed_ids):
            continue

        entries: list[Entry] = []
        story_image = (row.get("image_url") or None) or None
        for link in links:
            aid = str(link.get("article_id") or "")
            article = articles_by_id.get(aid, {})
            url = (
                (article.get("url") or "").strip()
                or (link.get("source_url") or "").strip()
            )
            if not url:
                continue
            source_name = (
                (article.get("source_name") or "").strip()
                or (link.get("source_name") or "").strip()
                or "Inbound Reports"
            )
            entries.append(
                Entry(
                    id=aid or url,
                    title=(article.get("title") or title).strip() or title,
                    summary=(article.get("summary") or row.get("summary_en") or "")[:500],
                    link=url,
                    source_name=source_name,
                    image_url=article.get("image_url") or story_image,
                )
            )

        if not entries:
            # Still mirror-able: one synthetic entry pointing at the story page.
            from newsbot.website_links import story_url

            entries = [
                Entry(
                    id=story_brief_id(story_id),
                    title=title,
                    summary=(row.get("summary_en") or "")[:500],
                    link=story_url(story_id),
                    source_name="Inbound Reports",
                    image_url=story_image,
                )
            ]

        result.append(
            SiteBriefStory(
                story_id=story_id,
                title=title,
                summary=(row.get("summary_en") or "").strip(),
                image_url=story_image,
                entries=entries,
            )
        )
    return result


def load_site_brief_stories(
    *,
    briefed_ids: set[str],
    now: datetime | None = None,
    hours: tuple[int, ...] | None = None,
    window_seconds: int | None = None,
    tz: ZoneInfo | None = None,
    limit: int = _STORY_FETCH_LIMIT,
    client: Any | None = None,
) -> list[SiteBriefStory]:
    """Fetch unbriefed Supabase stories since the previous Brief slot.

    ``window_seconds`` overrides the slot-based window with a rolling window
    (used by the continuous news poll). Returns [] when Supabase is unset,
    errors, or the window is empty.
    """
    if client is None and not supabase_ready():
        logger.warning(
            "Brief: SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY unset — "
            "Telegram Brief will fall back to RSS-only inventory."
        )
        return []

    zone = tz or _DEFAULT_TZ
    when = now or datetime.now(zone)
    if window_seconds is not None:
        since = when - timedelta(seconds=window_seconds)
    else:
        since = previous_brief_slot_start(when, hours=hours, tz=zone)

    try:
        sb = client
        if sb is None:
            from workers.db import get_supabase

            sb = get_supabase()
        story_rows = _fetch_story_rows(sb, since, limit)
        if not story_rows:
            logger.info("Brief: Supabase window since %s returned 0 stories.", since.isoformat())
            return []
        story_ids = [str(r["id"]) for r in story_rows if r.get("id")]
        source_rows = _fetch_source_rows(sb, story_ids)
        article_ids = [str(x["article_id"]) for x in source_rows if x.get("article_id")]
        article_rows = _fetch_article_rows(sb, article_ids)
    except Exception:
        logger.exception("Brief: Supabase inventory query failed")
        return []

    assembled = assemble_site_stories(story_rows, source_rows, article_rows, briefed_ids)
    logger.info(
        "Brief: Supabase fetched=%d assembled=%d since=%s briefed_skip=%d",
        len(story_rows),
        len(assembled),
        since.isoformat(),
        len(briefed_ids),
    )
    return assembled


def _fetch_story_rows(client: Any, since: datetime, limit: int) -> list[dict[str, Any]]:
    query = (
        client.table("stories")
        .select("id, title, summary_en, source_count, category, tags, created_at, image_url")
        .gte("created_at", since.isoformat())
    )
    if TECH_ONLY:
        # Match the website topic pages: only stories mapped to one of the 15
        # tech site slugs. Uncategorized/general stories never post to Telegram.
        query = query.in_("category", sorted(NEWS_CATEGORIES_SET))
    query = query.order("source_count", desc=True).order("created_at", desc=True).limit(limit)
    result = query.execute()
    return list(result.data or [])


def _fetch_source_rows(client: Any, story_ids: list[str]) -> list[dict[str, Any]]:
    if not story_ids:
        return []
    result = (
        client.table("story_sources")
        .select("story_id, article_id, source_name, source_url")
        .in_("story_id", story_ids[:100])
        .limit(500)
        .execute()
    )
    return list(result.data or [])


def _fetch_article_rows(client: Any, article_ids: list[str]) -> list[dict[str, Any]]:
    if not article_ids:
        return []
    result = (
        client.table("articles")
        .select("id, title, summary, url, source_name, image_url")
        .in_("id", article_ids[:100])
        .limit(500)
        .execute()
    )
    return list(result.data or [])
