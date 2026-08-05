"""Telegram bot handlers, broadcast logic, and fetch pipelines."""

from __future__ import annotations

import asyncio
import html
import json
import logging
import os
import re
import time
from dataclasses import dataclass, field
from datetime import datetime
from typing import Any, Callable

from telegram import InlineKeyboardButton, InlineKeyboardMarkup
from telegram.error import BadRequest, Forbidden
from telegram.ext import ContextTypes

from newsbot.ai import collect_links, pick_image_url, rewrite_compact, rewrite_compact_khmer, rewrite_with_ai, trim_for_caption
from newsbot import config
from newsbot.config import (
    BATCH_MAX_STORIES,
    BATCH_STORIES,
    DIGEST_HEADER_TEXT,
    DIGEST_MAX_STORIES,
    MAX_URGENT_POSTS_PER_RUN,
    NEWS_LANGUAGE,
    PREPARE_ENTRIES_TIMEOUT_SECONDS,
    TELEGRAM_CHANNEL_ID,
    TELEGRAM_THREAD_ID,
    TIMEZONE,
)
from newsbot.feeds import Entry, cluster_entries, collect_new_entries, looks_urgent, normalize_title_key
from newsbot.mirror import build_batch_payload, build_story_payload, drain, mirror_available, payload_to_entry, publish
from newsbot.state import get_state
from newsbot.website_links import brief_url, publish_cluster_story, reader_url

__all__ = [
    "StoryPost",
    "BatchedStory",
    "broadcast_stories",
    "broadcast_batched",
    "fetch_and_post",
    "fetch_urgent_and_post",
    "mirror_drain_job",
]

logger = logging.getLogger(__name__)

_pipeline_lock = asyncio.Lock()

_HTML_TAG_RE = re.compile(r"</?([a-zA-Z][a-zA-Z0-9]*)\b[^>]*/?>")
_VOID_TAGS = frozenset({"br", "hr", "img", "meta", "input", "link"})
# Reserve room so reopen/close tags don't push a segment past Telegram's 4096 limit.
_TRUNCATE_TAG_RESERVE = 180


def _html_escape(text: str) -> str:
    return html.escape(text, quote=False)


def _apply_html_tags_to_stack(stack: list[tuple[str, str]], fragment: str) -> list[tuple[str, str]]:
    """Update an open-tag stack by walking HTML tags in fragment."""
    stack = list(stack)
    for match in _HTML_TAG_RE.finditer(fragment):
        full = match.group(0)
        name = match.group(1).lower()
        if name in _VOID_TAGS or full.endswith("/>"):
            continue
        if full.startswith("</"):
            for i in range(len(stack) - 1, -1, -1):
                if stack[i][0] == name:
                    stack.pop(i)
                    break
        else:
            stack.append((name, full))
    return stack


def _close_html_tags(stack: list[tuple[str, str]]) -> str:
    return "".join(f"</{name}>" for name, _ in reversed(stack))


def _reopen_html_tags(stack: list[tuple[str, str]]) -> str:
    return "".join(full for _, full in stack)


@dataclass
class StoryPost:
    """One Telegram story ready to send."""

    text: str
    primary_url: str
    primary_source: str
    extra_urls: list[str] = field(default_factory=list)
    extra_sources: list[str] = field(default_factory=list)
    image_url: str | None = None
    entry_ids: set[str] = field(default_factory=set)
    entry_titles: set[str] = field(default_factory=set)
    entries: list[Entry] = field(default_factory=list)
    urgent: bool = False


@dataclass
class BatchedStory:
    """One compact story inside a batched digest message."""

    title: str
    summary: str
    source_line: str
    website_url: str
    image_url: str | None = None
    entry_ids: set[str] = field(default_factory=set)
    entry_titles: set[str] = field(default_factory=set)
    entries: list[Entry] = field(default_factory=list)


def _source_keyboard(post: StoryPost) -> InlineKeyboardMarkup:
    """CTA: open the story (or brief) — exclusive Local Lens + sources live on site."""
    label = "Cambodia Lens + sources →"
    return InlineKeyboardMarkup(
        [[InlineKeyboardButton(label, url=post.primary_url)]]
    )


def _brief_keyboard() -> InlineKeyboardMarkup:
    """Primary habit CTA for batched digests."""
    label = "Open today's Brief →"
    return InlineKeyboardMarkup(
        [[InlineKeyboardButton(label, url=brief_url())]]
    )


def _attribution_line(links: list[tuple[str, str]], website_url: str, limit: int = 3) -> str:
    """Plain source names + website deep link (no outbound source hrefs)."""
    names = [_html_escape(name) for _, name in links[:limit] if name]
    attribution = " · ".join(names) if names else "Multiple sources"
    safe_url = html.escape(website_url, quote=True)
    read_label = "sources + Local Lens"
    return f'{attribution} · <a href="{safe_url}">{read_label}</a>'


def _website_url_for_cluster(
    cluster: list[Entry],
    *,
    title: str,
    summary: str,
    category: str | None = None,
) -> str:
    story_id = publish_cluster_story(
        cluster,
        title=title,
        summary=summary,
        category=category,
        language="en",
    )
    return reader_url(title=title, story_id=story_id)


def _resolve_channel_target() -> tuple[int | None, int | None]:
    """Return (channel_id, thread_id), falling back to a fresh env read.

    Guards against a startup-timing race where validate_config() ran before
    TELEGRAM_CHANNEL_ID was fully propagated by the platform, which would
    otherwise leave TELEGRAM_CHANNEL_ID as None for the life of the process
    even though the env var is actually set.
    """
    if TELEGRAM_CHANNEL_ID is not None:
        return TELEGRAM_CHANNEL_ID, TELEGRAM_THREAD_ID

    raw_channel = os.environ.get("TELEGRAM_CHANNEL_ID", "").strip()
    if not raw_channel:
        return None, None
    try:
        channel_id = int(raw_channel)
    except ValueError:
        logger.error("TELEGRAM_CHANNEL_ID env var is set but not a valid integer: %r", raw_channel)
        return None, None

    thread_id = None
    raw_thread = os.environ.get("TELEGRAM_THREAD_ID", "").strip()
    if raw_thread:
        try:
            thread_id = int(raw_thread)
        except ValueError:
            logger.error("TELEGRAM_THREAD_ID env var is set but not a valid integer: %r", raw_thread)

    logger.info(
        "TELEGRAM_CHANNEL_ID was unresolved at startup, found via runtime env fallback "
        "(channel=%s thread=%s) — this is expected on Railway.",
        channel_id, thread_id,
    )
    return channel_id, thread_id


async def broadcast_stories(
    context: ContextTypes.DEFAULT_TYPE,
    stories: list[StoryPost],
) -> set[str]:
    """Send each story separately. Returns entry IDs that succeeded at least once."""
    if config.DISABLE_POSTING:
        logger.info("Posting disabled via DISABLE_POSTING — skipping %d stories.", len(stories))
        return set()

    targets: dict[int, int | None] = {}

    channel_id, thread_id_for_channel = _resolve_channel_target()
    if channel_id is not None:
        targets[channel_id] = thread_id_for_channel

    state = get_state()
    for chat_id in state.load_subscribers():
        chat_id = int(chat_id)
        # A subscriber that happens to be the known channel still gets routed
        # to the right topic/thread, instead of silently falling back to None.
        targets.setdefault(chat_id, thread_id_for_channel if chat_id == channel_id else None)

    if not targets:
        logger.warning("No channel or subscribers configured — nothing to send.")
        return set()

    succeeded_ids: set[str] = set()
    blocked_chats: set[int] = set()

    for post in stories:
        keyboard = _source_keyboard(post)
        story_ok = False
        for chat_id, thread_id in targets.items():
            if chat_id in blocked_chats:
                continue
            base: dict[str, Any] = {
                "chat_id": chat_id,
                "parse_mode": "HTML",
                "reply_markup": keyboard,
            }
            if thread_id is not None:
                base["message_thread_id"] = thread_id
            try:
                if post.image_url:
                    try:
                        await context.bot.send_photo(
                            photo=post.image_url,
                            caption=trim_for_caption(post.text),
                            **base,
                        )
                    except Forbidden:
                        logger.warning("Chat %s blocked the bot — will skip remaining stories", chat_id)
                        blocked_chats.add(chat_id)
                        continue
                    except BadRequest:
                        logger.warning("Photo failed for %s (bad request) — falling back to text", chat_id)
                        await context.bot.send_message(
                            text=post.text,
                            disable_web_page_preview=True,
                            **base,
                        )
                    except Exception:
                        logger.exception("Photo send failed for %s — falling back to text", chat_id)
                        await context.bot.send_message(
                            text=post.text,
                            disable_web_page_preview=True,
                            **base,
                        )
                else:
                    await context.bot.send_message(
                        text=post.text,
                        disable_web_page_preview=True,
                        **base,
                    )
                story_ok = True
            except Forbidden:
                logger.warning("Chat %s blocked the bot — will skip remaining stories", chat_id)
                blocked_chats.add(chat_id)
            except Exception:
                logger.exception("Failed to send story to %s", chat_id)
        if story_ok:
            succeeded_ids.update(post.entry_ids)

    if blocked_chats:
        subscribers = state.load_subscribers()
        removed = subscribers & blocked_chats
        if removed:
            state.save_subscribers(subscribers - blocked_chats)
            logger.info("Auto-unsubscribed %d blocked chat(s): %s", len(removed), removed)

    return succeeded_ids


def _rank_clusters(clusters: list[list[Entry]]) -> list[list[Entry]]:
    """Prefer multi-source clusters, then keep feed order within the same size."""
    indexed = list(enumerate(clusters))
    indexed.sort(key=lambda item: (-len(item[1]), item[0]))
    return [c for _, c in indexed]


def _cluster_to_story(
    cluster: list[Entry],
    *,
    urgent: bool,
    header: str | None = None,
    website_url: str | None = None,
) -> StoryPost | None:
    try:
        text = rewrite_with_ai(cluster, urgent=urgent, header=header)
    except Exception:
        title = cluster[0].title if cluster else "?"
        logger.exception("Failed to generate post for '%s'", title)
        return None

    links = collect_links(cluster, urgent=urgent)
    if not links:
        return None

    primary_source = links[0][1]
    if website_url:
        website = website_url
    else:
        # Title for the website page — prefer first entry title
        page_title = cluster[0].title if cluster else "Untitled"
        # Strip HTML from rewrite for story summary storage (best-effort)
        plain_summary = re.sub(r"<[^>]+>", "", text)[:1500]
        website = _website_url_for_cluster(
            cluster,
            title=page_title,
            summary=plain_summary,
        )

    return StoryPost(
        text=text,
        primary_url=website,
        primary_source=primary_source or "Inbound Reports",
        extra_urls=[],
        extra_sources=[],
        image_url=pick_image_url(cluster),
        entry_ids={e.id for e in cluster},
        entry_titles={e.title for e in cluster},
        entries=cluster,
        urgent=urgent,
    )


def _source_line(links: list[tuple[str, str]], limit: int = 3) -> str:
    """Deprecated path — kept for tests; prefer _attribution_line."""
    names = [_html_escape(name) for _, name in links[:limit] if name]
    return " · ".join(names)


def _cluster_to_batched(
    cluster: list[Entry],
    *,
    website_url: str | None = None,
) -> BatchedStory | None:
    try:
        if NEWS_LANGUAGE == "km":
            title, summary = rewrite_compact_khmer(cluster)
        else:
            title = cluster[0].title or "Untitled"
            summary = rewrite_compact(cluster)
    except Exception:
        title = cluster[0].title if cluster else "?"
        logger.exception("Failed to generate compact summary for '%s'", title)
        return None

    links = collect_links(cluster)
    if not links:
        return None

    website = website_url or _website_url_for_cluster(cluster, title=title, summary=summary)

    return BatchedStory(
        title=title,
        summary=summary,
        source_line=_attribution_line(links, website),
        website_url=website,
        image_url=pick_image_url(cluster),
        entry_ids={e.id for e in cluster},
        entry_titles={e.title for e in cluster},
        entries=cluster,
    )


def _pick_batch_image(batched: list[BatchedStory]) -> str | None:
    for s in batched:
        if s.image_url:
            return s.image_url
    return None


def _compile_batch_message(batched: list[BatchedStory]) -> str:
    now = datetime.now(TIMEZONE).strftime("%b %d, %Y · %I:%M %p")
    separator = "━" * 20
    brief = html.escape(brief_url(), quote=True)
    tease_line = (
        'Tease only — full sources + <b>Local Lens (Cambodia)</b> on the '
        f'<a href="{brief}">daily Brief</a>.'
    )
    brief_footer = f'<a href="{brief}">→ Open today\'s Brief on Inbound Reports</a>'
    parts: list[str] = [
        f"{DIGEST_HEADER_TEXT} — {now}",
        separator,
        tease_line,
    ]

    for s in batched:
        parts.append("")
        safe_url = html.escape(s.website_url, quote=True)
        parts.append(f'▸ <b><a href="{safe_url}">{_html_escape(s.title)}</a></b>')
        # Keep Telegram short so the site visit still pays off
        teaser = (s.summary or "").strip()
        if len(teaser) > 280:
            cut = teaser[:277].rsplit(" ", 1)[0]
            teaser = f"{cut}…"
        parts.append(_html_escape(teaser) if teaser else "")
        if s.source_line:
            parts.append(s.source_line)

    parts.append("")
    parts.append(separator)
    parts.append(brief_footer)
    return "\n".join(parts)


def _truncate_batch(text: str) -> list[str]:
    """Split long batch messages at paragraph boundaries, keeping HTML tags balanced."""
    _MAX = 4096
    if len(text) <= _MAX:
        return [text]

    parts: list[str] = []
    open_stack: list[tuple[str, str]] = []
    remaining = text

    while remaining:
        reopen = _reopen_html_tags(open_stack)
        budget = _MAX - len(reopen) - _TRUNCATE_TAG_RESERVE
        if budget < 256:
            budget = max(256, _MAX // 2)

        if len(remaining) <= budget:
            body = remaining
            remaining = ""
        else:
            cut = remaining.rfind("\n\n", 0, budget)
            if cut == -1:
                cut = remaining.rfind("\n", 0, budget)
            if cut == -1:
                cut = budget
            body = remaining[:cut].rstrip()
            remaining = remaining[cut:].lstrip()

        stack_after = _apply_html_tags_to_stack(open_stack, body)
        close = _close_html_tags(stack_after)
        parts.append(f"{reopen}{body}{close}")
        open_stack = stack_after

    return parts


async def broadcast_batched(
    context: ContextTypes.DEFAULT_TYPE,
    batched: list[BatchedStory],
) -> set[str]:
    if config.DISABLE_POSTING:
        logger.info("Posting disabled — skipping batch of %d stories.", len(batched))
        return set()

    channel_id, thread_id = _resolve_channel_target()
    if channel_id is None:
        logger.warning("No channel configured — nothing to send.")
        return set()

    message = _compile_batch_message(batched)
    if not message:
        return set()

    batch_image = _pick_batch_image(batched)
    succeeded_ids: set[str] = set()

    brief_markup = _brief_keyboard()
    try:
        if batch_image:
            caption_title = "Tech News"
            caption = (
                f"<b>📰 {caption_title} — {datetime.now(TIMEZONE).strftime('%b %d, %Y · %I:%M %p')}</b>"
                + "\nFull Brief + Local Lens on Inbound Reports"
            )
            try:
                photo_msg = await context.bot.send_photo(
                    chat_id=channel_id,
                    photo=batch_image,
                    caption=caption,
                    parse_mode="HTML",
                    reply_markup=brief_markup,
                    message_thread_id=thread_id,
                )
            except Exception:
                logger.warning("Batch photo failed — falling back to text-only")
                photo_msg = None

            segments = _truncate_batch(message)
            for i, seg in enumerate(segments):
                kwargs: dict = {
                    "chat_id": channel_id,
                    "text": seg,
                    "parse_mode": "HTML",
                    "disable_web_page_preview": True,
                }
                if thread_id is not None:
                    kwargs["message_thread_id"] = thread_id
                if i == 0 and photo_msg is not None:
                    kwargs["reply_to_message_id"] = photo_msg.message_id
                # Put the habit CTA on the first text segment when there is no photo button
                if i == 0 and photo_msg is None:
                    kwargs["reply_markup"] = brief_markup
                elif i == len(segments) - 1 and photo_msg is not None:
                    kwargs["reply_markup"] = brief_markup
                await context.bot.send_message(**kwargs)
        else:
            segments = _truncate_batch(message)
            for i, seg in enumerate(segments):
                kwargs = {
                    "chat_id": channel_id,
                    "text": seg,
                    "parse_mode": "HTML",
                    "disable_web_page_preview": True,
                }
                if thread_id is not None:
                    kwargs["message_thread_id"] = thread_id
                if i == 0:
                    kwargs["reply_markup"] = brief_markup
                await context.bot.send_message(**kwargs)

        for s in batched:
            succeeded_ids.update(s.entry_ids)
    except Exception:
        logger.exception("Failed to send batched digest")

    return succeeded_ids


def _prepare_entries(urgent: bool = False, header: str | None = None) -> list[StoryPost]:
    """Shared pipeline: collect, cluster, rewrite entries."""
    state = get_state()
    posted_ids = state.load_posted_ids()
    posted_titles = state.load_posted_titles()
    entries = collect_new_entries(posted_ids, posted_titles)
    if not entries:
        logger.info("No new entries for %s.", "urgent" if urgent else "digest")
        return []

    if urgent:
        clusters = [
            c for c in cluster_entries(entries) if looks_urgent(c)
        ][:MAX_URGENT_POSTS_PER_RUN]
    else:
        clusters = _rank_clusters(cluster_entries(entries))[:DIGEST_MAX_STORIES]

    stories: list[StoryPost] = []
    n = len(clusters)
    for index, cluster in enumerate(clusters, start=1):
        if header and not urgent:
            today = datetime.now(TIMEZONE).strftime("%B %d, %Y")
            item_header = f"📰 {index}/{n} · {today}"
        else:
            item_header = None
        story = _cluster_to_story(cluster, urgent=urgent, header=item_header)
        if story:
            stories.append(story)
        # Pace AI calls so a full digest (up to DIGEST_MAX_STORIES back-to-back
        # completions) doesn't burst past Groq's per-minute token/request limit.
        if index < n:
            time.sleep(1.5)
    return stories


def _mark_posted(stories: list[StoryPost], succeeded: set[str]) -> None:
    """Mark successfully sent stories as posted in state."""
    state = get_state()
    state.add_posted_ids(succeeded)
    titles = set()
    for s in stories:
        if s.entry_ids & succeeded:
            titles.update(normalize_title_key(t) for t in s.entry_titles)
    state.add_posted_titles(titles)


async def _run_pipeline(
    context: ContextTypes.DEFAULT_TYPE,
    *,
    urgent: bool = False,
) -> int:
    """Shared pipeline: prepare → broadcast → mark posted (individual path)."""
    async with _pipeline_lock:
        try:
            stories = await asyncio.wait_for(
                asyncio.to_thread(_prepare_entries, urgent=urgent),
                timeout=PREPARE_ENTRIES_TIMEOUT_SECONDS,
            )
        except asyncio.TimeoutError:
            label = "urgent" if urgent else "digest"
            logger.error(
                "_prepare_entries timed out after %.0fs (%s run)",
                PREPARE_ENTRIES_TIMEOUT_SECONDS,
                label,
            )
            return 0
        if not stories:
            label = "urgent" if urgent else "digest"
            logger.info("No posts generated this %s run.", label)
            return 0

        succeeded = await broadcast_stories(context, stories)
        if succeeded:
            _mark_posted(stories, succeeded)
            _publish_mirror_stories(stories, succeeded)
            count = sum(1 for s in stories if s.entry_ids & succeeded)
            label = "urgent" if urgent else "digest"
            logger.info("Sent %d %s stor(y/ies).", count, label)
            return count

        logger.error("Broadcast failed — not marking posted IDs.")
        return 0


async def _run_batched_pipeline(context: ContextTypes.DEFAULT_TYPE) -> int:
    async with _pipeline_lock:
        state = get_state()
        posted_ids = state.load_posted_ids()
        posted_titles = state.load_posted_titles()
        entries = collect_new_entries(posted_ids, posted_titles)
        if not entries:
            logger.info("No new entries for batched digest.")
            return 0

        all_clusters = _rank_clusters(cluster_entries(entries))
        if not all_clusters:
            return 0

        # 1 story → individual path (full rewrite + keyboard)
        if len(all_clusters) == 1:
            try:
                stories = await asyncio.wait_for(
                    asyncio.to_thread(_prepare_entries, urgent=False),
                    timeout=PREPARE_ENTRIES_TIMEOUT_SECONDS,
                )
            except asyncio.TimeoutError:
                logger.error(
                    "_prepare_entries timed out after %.0fs (batched single-story)",
                    PREPARE_ENTRIES_TIMEOUT_SECONDS,
                )
                return 0
            if not stories:
                return 0
            succeeded = await broadcast_stories(context, stories)
            if succeeded:
                _mark_posted(stories, succeeded)
                _publish_mirror_stories(stories, succeeded)
                return 1
            return 0

        # 2-4 stories → batch path
        clusters = all_clusters[:BATCH_MAX_STORIES]

        def _prepare_batched() -> list[BatchedStory]:
            result: list[BatchedStory] = []
            for cluster in clusters:
                entry = _cluster_to_batched(cluster)
                if entry:
                    result.append(entry)
            return result

        try:
            batched = await asyncio.wait_for(
                asyncio.to_thread(_prepare_batched),
                timeout=PREPARE_ENTRIES_TIMEOUT_SECONDS,
            )
        except asyncio.TimeoutError:
            logger.error(
                "Batched compact rewrite timed out after %.0fs",
                PREPARE_ENTRIES_TIMEOUT_SECONDS,
            )
            return 0

        if not batched:
            logger.warning("All clusters failed compact rewrite — nothing to send.")
            return 0

        succeeded = await broadcast_batched(context, batched)
        if succeeded:
            _mark_posted_batched(batched, succeeded)
            _publish_mirror_batched(batched)
            count = len(batched)
            logger.info("Sent batched digest with %d stor(y/ies).", count)
            return count

        return 0


def _mark_posted_batched(batched: list[BatchedStory], succeeded: set[str]) -> None:
    state = get_state()
    state.add_posted_ids(succeeded)
    titles = set()
    for s in batched:
        if s.entry_ids & succeeded:
            titles.update(normalize_title_key(t) for t in s.entry_titles)
    state.add_posted_titles(titles)


async def fetch_and_post(context: ContextTypes.DEFAULT_TYPE) -> int:
    """Fetch feeds. Batched path when BATCH_STORIES is on, else individual path."""
    if BATCH_STORIES:
        return await _run_batched_pipeline(context)
    return await _run_pipeline(context, urgent=False)


async def fetch_urgent_and_post(context: ContextTypes.DEFAULT_TYPE) -> int:
    """Hourly urgent path: keyword matches only; skip already-posted IDs."""
    return await _run_pipeline(context, urgent=True)


def _publish_mirror_stories(stories: list[StoryPost], succeeded: set[str]) -> None:
    """English bot: enqueue sent stories for the Khmer mirror bot."""
    if NEWS_LANGUAGE != "en" or not mirror_available():
        return
    for s in stories:
        if s.entry_ids & succeeded and s.entries:
            publish(build_story_payload(s))


def _publish_mirror_batched(batched: list[BatchedStory]) -> None:
    """English bot: enqueue a sent batch digest for the Khmer mirror bot."""
    if NEWS_LANGUAGE != "en" or not mirror_available():
        return
    if batched and any(s.entries for s in batched):
        publish(build_batch_payload(batched))


async def mirror_drain_job(context: ContextTypes.DEFAULT_TYPE) -> None:
    """km mode: re-post whatever the English bot published, in Khmer."""
    if NEWS_LANGUAGE != "km" or not mirror_available():
        return
    payloads = await asyncio.to_thread(drain)
    for payload in payloads:
        try:
            if payload.get("kind") == "batch":
                await _mirror_batch(context, payload)
            else:
                await _mirror_story(context, payload)
        except Exception:
            logger.exception("Mirror: failed to process %s", payload.get("kind"))


async def _mirror_story(context: ContextTypes.DEFAULT_TYPE, payload: dict) -> None:
    cluster = [payload_to_entry(d) for d in payload.get("cluster", [])]
    if not cluster:
        return
    story = _cluster_to_story(
        cluster,
        urgent=bool(payload.get("urgent")),
        website_url=payload.get("website_url"),
    )
    if not story:
        return
    succeeded = await broadcast_stories(context, [story])
    if succeeded:
        _mark_posted([story], succeeded)
        logger.info("Mirror: posted Khmer story (%d entries).", len(cluster))


async def _mirror_batch(context: ContextTypes.DEFAULT_TYPE, payload: dict) -> None:
    batched: list[BatchedStory] = []
    for item in payload.get("stories", []):
        cluster = [payload_to_entry(d) for d in item.get("cluster", [])]
        if not cluster:
            continue
        story = _cluster_to_batched(cluster, website_url=item.get("website_url"))
        if story:
            batched.append(story)
    if not batched:
        return
    succeeded = await broadcast_batched(context, batched)
    if succeeded:
        _mark_posted_batched(batched, succeeded)
        logger.info("Mirror: posted Khmer batch digest (%d stories).", len(batched))