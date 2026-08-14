"""Telegram bot handlers, broadcast logic, and fetch pipelines."""

from __future__ import annotations

import asyncio
import html
import logging
import os
import re
import time
from dataclasses import dataclass, field
from datetime import datetime
from typing import Any, Awaitable, Callable

from telegram import InlineKeyboardButton, InlineKeyboardMarkup
from telegram.error import BadRequest, Forbidden, NetworkError, RetryAfter, TimedOut
from telegram.ext import ContextTypes

from newsbot.ai import (
    KhmerTranslationFailed,
    MirrorRewriteFailed,
    collect_links,
    pick_image_url,
    rewrite_compact,
    rewrite_compact_khmer,
    rewrite_with_ai,
    translate_compact_to_km,
    translate_en_post_to_km,
    trim_for_caption,
)
from newsbot import config
from newsbot.brief_cta import raise_if_legacy_brief_cta
from newsbot.brief_inventory import SiteBriefStory, load_site_brief_stories
from newsbot.config import (
    BATCH_MAX_STORIES,
    BATCH_STORIES,
    BRIEF_SCHEDULE_HOURS,
    DIGEST_HEADER_TEXT,
    DIGEST_MAX_STORIES,
    MAX_URGENT_POSTS_PER_RUN,
    NEWS_LANGUAGE,
    PREPARE_ENTRIES_TIMEOUT_SECONDS,
    TELEGRAM_CHANNEL_ID,
    TELEGRAM_THREAD_ID,
    TIMEZONE,
)
from newsbot.feeds import (
    Entry,
    cluster_entries,
    collect_new_entries,
    looks_urgent,
    normalize_title_key,
)
from workers.images import is_valid_image_url
from newsbot.mirror import (
    build_batch_payload,
    build_story_payload,
    drain,
    flush_outbox,
    mirror_available,
    payload_to_entry,
    publish,
    settle,
)
from newsbot.state import get_state
from newsbot.website_links import brief_url, publish_cluster_story, reader_url, story_url

__all__ = [
    "StoryPost",
    "BatchedStory",
    "broadcast_stories",
    "broadcast_batched",
    "fetch_and_post",
    "fetch_individual_and_post",
    "fetch_urgent_and_post",
    "mirror_drain_job",
    "mirror_outbox_flush_job",
]

logger = logging.getLogger(__name__)

_pipeline_lock = asyncio.Lock()
_mirror_drain_lock = asyncio.Lock()

# Telegram enforces broadcast rate limits (~30 messages/second across chats,
# ~1/second to a single chat). Space sends slightly and honor RetryAfter so a
# large fan-out (urgent alerts, Khmer mirror) never silently drops posts or
# trips an escalating flood wait.
_SEND_THROTTLE_SECONDS: float = float(os.environ.get("SEND_THROTTLE_SECONDS", "0.05"))
_SEND_MAX_RETRIES: int = 4


async def _tg_send(method: Callable[..., Awaitable[Any]], **kwargs: Any) -> Any:
    """Invoke a Telegram send with RetryAfter and transient-error handling.

    ``Forbidden`` and ``BadRequest`` propagate to the caller (blocked chat /
    bad photo handling); only rate limits and transient network errors are
    retried here, with a short post-send throttle to stay under Telegram's
    per-second broadcast ceiling. The deleted empty-slot Brief CTA is refused.
    """
    raise_if_legacy_brief_cta(kwargs.get("text"), field="text")
    raise_if_legacy_brief_cta(kwargs.get("caption"), field="caption")
    for attempt in range(_SEND_MAX_RETRIES + 1):
        try:
            result = await method(**kwargs)
            if _SEND_THROTTLE_SECONDS:
                await asyncio.sleep(_SEND_THROTTLE_SECONDS)
            return result
        except RetryAfter as exc:
            wait = float(getattr(exc, "retry_after", 3) or 3) + 0.5
            if attempt == _SEND_MAX_RETRIES:
                logger.error(
                    "Telegram rate limit persisted after %d retries — dropping this send.",
                    _SEND_MAX_RETRIES,
                )
                raise
            logger.warning(
                "Telegram RetryAfter — sleeping %.1fs (attempt %d/%d).",
                wait,
                attempt + 1,
                _SEND_MAX_RETRIES,
            )
            await asyncio.sleep(wait)
        except (TimedOut, NetworkError):
            if attempt == _SEND_MAX_RETRIES:
                raise
            await asyncio.sleep(1.0 * (attempt + 1))

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
    from newsbot.config import brief_button_label

    return InlineKeyboardMarkup(
        [[InlineKeyboardButton(brief_button_label(), url=brief_url())]]
    )


def _attribution_line(links: list[tuple[str, str]], limit: int = 3) -> str:
    """Hyperlink each source name directly to its original news article URL."""
    items: list[str] = []
    for url, name in links[:limit]:
        safe_url = html.escape(url, quote=True)
        safe_name = _html_escape(name or "Source")
        items.append(f'<a href="{safe_url}">{safe_name}</a>')

    if not items:
        return ""

    return f'<i>{" · ".join(items)}</i>'


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

    state = get_state()
    group_threads: dict[int, int] = state.load_group_threads()

    targets: dict[int, int | None] = {}
    channel_id, thread_id_for_channel = _resolve_channel_target()
    if channel_id is not None:
        # Env-configured TELEGRAM_THREAD_ID always wins for the primary channel.
        # Auto-learned group_threads (from /start in a topic) is only a fallback
        # for when no thread is explicitly configured — otherwise a stray /start
        # in the wrong topic silently hijacks routing forever (see incident:
        # group_threads auto-learn overriding configured thread IDs).
        targets[channel_id] = (
            thread_id_for_channel
            if thread_id_for_channel is not None
            else group_threads.get(channel_id)
        )

    for chat_id in state.load_subscribers():
        chat_id = int(chat_id)
        # A subscriber that happens to be the known channel still gets routed
        # to the right topic/thread, instead of silently falling back to None.
        # Subscribed groups use their recorded topic (e.g. the News topic) when
        # /start was run inside one.
        if chat_id in targets:
            continue
        targets[chat_id] = group_threads.get(chat_id)

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
                        await _tg_send(
                            context.bot.send_photo,
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
                        await _tg_send(
                            context.bot.send_message,
                            text=post.text,
                            disable_web_page_preview=True,
                            **base,
                        )
                    except Exception:
                        logger.exception("Photo send failed for %s — falling back to text", chat_id)
                        await _tg_send(
                            context.bot.send_message,
                            text=post.text,
                            disable_web_page_preview=True,
                            **base,
                        )
                else:
                    await _tg_send(
                        context.bot.send_message,
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
    except KhmerTranslationFailed:
        # Propagate so the mirror job can requeue instead of posting English.
        raise
    except Exception as exc:
        title = cluster[0].title if cluster else "?"
        logger.exception("Failed to generate post for '%s'", title)
        if NEWS_LANGUAGE == "km":
            raise MirrorRewriteFailed(f"story rewrite failed: {title}") from exc
        return None

    links = collect_links(cluster, urgent=urgent)
    if not links:
        if NEWS_LANGUAGE == "km":
            raise MirrorRewriteFailed("story missing links after rewrite")
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
    except KhmerTranslationFailed:
        raise
    except Exception as exc:
        title = cluster[0].title if cluster else "?"
        logger.exception("Failed to generate compact summary for '%s'", title)
        if NEWS_LANGUAGE == "km":
            raise MirrorRewriteFailed(f"batch rewrite failed: {title}") from exc
        return None

    links = collect_links(cluster)
    if not links:
        if NEWS_LANGUAGE == "km":
            raise MirrorRewriteFailed("batch story missing links after rewrite")
        return None

    website = website_url or _website_url_for_cluster(cluster, title=title, summary=summary)

    return BatchedStory(
        title=title,
        summary=summary,
        source_line=_attribution_line(links),
        website_url=website,
        image_url=pick_image_url(cluster),
        entry_ids={e.id for e in cluster},
        entry_titles={e.title for e in cluster},
        entries=cluster,
    )


def _site_stories_to_batched(stories: list[SiteBriefStory]) -> list[BatchedStory]:
    """Turn website stories into digest rows (site copy, no second EN rewrite)."""
    batched: list[BatchedStory] = []
    for story in stories:
        links = [(e.link, e.source_name) for e in story.entries if e.link]
        batched.append(
            BatchedStory(
                title=story.title,
                summary=story.summary,
                source_line=_attribution_line(links),
                website_url=story_url(story.story_id),
                image_url=story.image_url,
                entry_ids=story.entry_ids,
                entry_titles=story.entry_titles,
                entries=list(story.entries),
            )
        )
    return batched


def _pick_batch_image(batched: list[BatchedStory]) -> str | None:
    for s in batched:
        if s.image_url:
            return s.image_url
    return None


def _compile_batch_message(batched: list[BatchedStory]) -> str:
    now = datetime.now(TIMEZONE).strftime("%b %d, %Y · %I:%M %p")
    separator = "─────────────────────────────"
    brief = html.escape(brief_url(), quote=True)
    tease_line = (
        '💡 <i>Tease only — full sources + <b>Local Lens (Cambodia)</b> on the '
        f'<a href="{brief}">daily Brief</a>.</i>'
    )
    brief_footer = f'🌐 <a href="{brief}"><b>Open today\'s Brief on Inbound Reports →</b></a>'
    parts: list[str] = [
        f"📰 <b>{_html_escape(DIGEST_HEADER_TEXT)}</b> · <i>{now}</i>",
        separator,
        tease_line,
    ]

    for s in batched:
        parts.append("")
        parts.append(f'🔹 <b>{_html_escape(s.title)}</b>')
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
                photo_msg = await _tg_send(
                    context.bot.send_photo,
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
                await _tg_send(context.bot.send_message, **kwargs)
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
                await _tg_send(context.bot.send_message, **kwargs)

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
    if NEWS_LANGUAGE == "km":
        logger.warning(
            "Khmer bot (NEWS_LANGUAGE=km) must not run direct RSS ingestion. "
            "All Khmer posts originate from the English bot's mirror queue."
        )
        return 0
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
    """Multi-story Daily Brief path.

    Prefer unbriefed Supabase stories (same pool as the website Brief). RSS is
    fallback when that pool is empty or Supabase is unset/down.

    ``briefed_ids`` (not ``posted_ids``) gates repeats so ASAP urgents can
    still appear once in a Brief.
    """
    if NEWS_LANGUAGE == "km":
        logger.warning(
            "Khmer bot (NEWS_LANGUAGE=km) must not run direct RSS ingestion. "
            "All Khmer posts originate from the English bot's mirror queue."
        )
        return 0
    async with _pipeline_lock:
        state = get_state()
        briefed_ids = state.load_briefed_ids()
        posted_ids = state.load_posted_ids()

        site_stories: list[SiteBriefStory] = []
        try:
            site_stories = await asyncio.wait_for(
                asyncio.to_thread(
                    load_site_brief_stories,
                    briefed_ids=briefed_ids,
                    hours=BRIEF_SCHEDULE_HOURS,
                    tz=TIMEZONE,
                ),
                timeout=PREPARE_ENTRIES_TIMEOUT_SECONDS,
            )
        except asyncio.TimeoutError:
            logger.error(
                "Brief: Supabase inventory timed out after %.0fs — RSS fallback.",
                PREPARE_ENTRIES_TIMEOUT_SECONDS,
            )
        except Exception:
            logger.exception("Brief: Supabase inventory failed — RSS fallback.")

        if site_stories:
            batched = _site_stories_to_batched(site_stories)[:BATCH_MAX_STORIES]
            logger.info(
                "Brief: supabase_eligible=%d rss_fallback=0 briefed_skip=%d",
                len(batched),
                len(briefed_ids),
            )
            if not batched:
                return 0
            succeeded = await broadcast_batched(context, batched)
            if succeeded:
                _mark_posted_batched(batched, succeeded)
                _mark_briefed_batched(batched, succeeded)
                _publish_mirror_batched(batched)
                logger.info(
                    "Brief: sent batched digest with %d stor(y/ies) (source=supabase).",
                    len(batched),
                )
                return len(batched)
            return 0

        # RSS fallback — do not pass posted_titles; ASAP-posted stay Brief-eligible.
        entries = collect_new_entries(briefed_ids, set())
        if not entries:
            logger.info(
                "Brief: supabase_eligible=0 rss_fallback=0 no eligible entries "
                "(briefed=%d posted=%d).",
                len(briefed_ids),
                len(posted_ids),
            )
            return 0

        already_posted = sum(1 for e in entries if e.id in posted_ids)
        logger.info(
            "Brief: supabase_eligible=0 rss_fallback=%d already_posted_asap=%d "
            "briefed_skip_set=%d",
            len(entries),
            already_posted,
            len(briefed_ids),
        )

        all_clusters = _rank_clusters(cluster_entries(entries))
        if not all_clusters:
            logger.info("Brief: clustering produced no clusters.")
            return 0

        # 1 story → individual path (full rewrite + keyboard)
        if len(all_clusters) == 1:
            cluster = all_clusters[0]
            try:
                story = await asyncio.wait_for(
                    asyncio.to_thread(_cluster_to_story, cluster, urgent=False),
                    timeout=PREPARE_ENTRIES_TIMEOUT_SECONDS,
                )
            except asyncio.TimeoutError:
                logger.error(
                    "_cluster_to_story timed out after %.0fs (batched single-story)",
                    PREPARE_ENTRIES_TIMEOUT_SECONDS,
                )
                return 0
            if not story:
                logger.warning("Brief: single cluster rewrite failed — nothing to send.")
                return 0
            succeeded = await broadcast_stories(context, [story])
            if succeeded:
                _mark_posted([story], succeeded)
                _mark_briefed([story], succeeded)
                _publish_mirror_stories([story], succeeded)
                logger.info("Brief: sent single-story digest (1).")
                return 1
            return 0

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
            _mark_briefed_batched(batched, succeeded)
            _publish_mirror_batched(batched)
            count = len(batched)
            logger.info(
                "Brief: sent batched digest with %d stor(y/ies) (clusters_considered=%d).",
                count,
                len(clusters),
            )
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


def _mark_briefed(stories: list[StoryPost], succeeded: set[str]) -> None:
    ids = {eid for s in stories for eid in s.entry_ids if eid in succeeded}
    if ids:
        get_state().add_briefed_ids(ids)


def _mark_briefed_batched(batched: list[BatchedStory], succeeded: set[str]) -> None:
    ids = {eid for s in batched for eid in s.entry_ids if eid in succeeded}
    if ids:
        get_state().add_briefed_ids(ids)


async def fetch_and_post(context: ContextTypes.DEFAULT_TYPE) -> int:
    """Fetch feeds. Batched path when BATCH_STORIES is on, else individual path."""
    if BATCH_STORIES:
        return await _run_batched_pipeline(context)
    return await _run_pipeline(context, urgent=False)


async def fetch_individual_and_post(context: ContextTypes.DEFAULT_TYPE) -> int:
    """Digest path: post each top story as its own Telegram message.

    Sends every story separately (with sources) to the channel and
    subscribers, and enqueues a mirror payload per story so the Khmer bot
    re-posts each one individually too.
    """
    return await _run_pipeline(context, urgent=False)


async def fetch_urgent_and_post(context: ContextTypes.DEFAULT_TYPE) -> int:
    """ASAP path: rare must-know keyword matches only; skip already-posted IDs."""
    return await _run_pipeline(context, urgent=True)


def _publish_mirror_stories(stories: list[StoryPost], succeeded: set[str]) -> None:
    """English bot: enqueue sent stories for the Khmer mirror bot."""
    if NEWS_LANGUAGE != "en":
        return
    for s in stories:
        if not (s.entry_ids & succeeded and s.entries):
            continue
        if not publish(build_story_payload(s)):
            logger.error(
                "Mirror: EN post public but live enqueue failed for story ids=%s "
                "(deadletter/outbox hold a copy)",
                sorted(s.entry_ids),
            )


def _publish_mirror_batched(batched: list[BatchedStory]) -> None:
    """English bot: enqueue a sent batch digest for the Khmer mirror bot."""
    if NEWS_LANGUAGE != "en":
        return
    if not (batched and any(s.entries for s in batched)):
        return
    if not publish(build_batch_payload(batched)):
        ids = sorted({eid for s in batched for eid in s.entry_ids})
        logger.error(
            "Mirror: EN batch public but live enqueue failed for story ids=%s "
            "(deadletter/outbox hold a copy)",
            ids,
        )


async def mirror_outbox_flush_job(context: ContextTypes.DEFAULT_TYPE) -> None:
    """EN: push local outbox payloads into Redis after transient outages."""
    if NEWS_LANGUAGE != "en":
        return
    n = await asyncio.to_thread(flush_outbox)
    if n:
        logger.info("Mirror: outbox flush job recovered %d payload(s).", n)


async def mirror_drain_job(context: ContextTypes.DEFAULT_TYPE) -> None:
    """km mode: re-post whatever the English bot published, in Khmer."""
    if NEWS_LANGUAGE != "km" or not mirror_available():
        return
    if _mirror_drain_lock.locked():
        logger.info("Mirror: drain already running — skipping overlapping tick.")
        return
    async with _mirror_drain_lock:
        items = await asyncio.to_thread(drain)
        for item in items:
            payload = item.payload
            raw = item.raw
            success = False
            poison = False
            try:
                if payload.get("kind") == "batch":
                    success, poison = await _mirror_batch(context, payload)
                else:
                    success, poison = await _mirror_story(context, payload)
            except (KhmerTranslationFailed, MirrorRewriteFailed) as exc:
                logger.warning("Mirror: rewrite failed — %s", exc)
            except Exception:
                logger.exception("Mirror: failed to process %s", payload.get("kind"))
            settled = await asyncio.to_thread(
                settle, payload, raw, success=success, poison=poison
            )
            if not settled and not success:
                logger.error(
                    "Mirror: settle failed for %s — item left in processing",
                    payload.get("kind"),
                )


def _safe_link(url: object) -> str | None:
    """Accept only well-formed public http(s) URLs from untrusted mirror payloads."""
    if not isinstance(url, str):
        return None
    return url.strip() if is_valid_image_url(url) else None


def _mirror_already_posted(entry_ids: set[str]) -> bool:
    """True when every id was already marked posted on this (KM) bot."""
    ids = {i for i in entry_ids if i}
    if not ids:
        return False
    posted = get_state().load_posted_ids()
    return ids <= posted


def _entry_ids_from_batch_payload(stories_in: list) -> set[str]:
    ids: set[str] = set()
    for item in stories_in:
        if not isinstance(item, dict):
            continue
        for d in item.get("cluster", []) or []:
            if not isinstance(d, dict):
                continue
            eid = str(d.get("id") or "")
            if eid:
                ids.add(eid)
    return ids


async def _mirror_story(
    context: ContextTypes.DEFAULT_TYPE, payload: dict
) -> tuple[bool, bool]:
    """Returns ``(success, poison)``. Poison → deadletter; else failure → requeue."""
    cluster = [payload_to_entry(d) for d in payload.get("cluster", [])]
    if not cluster:
        logger.warning("Mirror: empty story cluster — deadletter (poison)")
        return False, True

    entry_ids = {e.id for e in cluster if e.id}
    if _mirror_already_posted(entry_ids):
        logger.info("Mirror: story already posted on KM — treating as success (idempotent)")
        return True, False

    story: StoryPost | None = None
    en_text = (payload.get("en_text") or "").strip()
    if en_text:
        try:
            km_text = translate_en_post_to_km(en_text)
            links = collect_links(cluster, urgent=bool(payload.get("urgent")))
            primary_source = links[0][1] if links else "Inbound Reports"
            website = _safe_link(payload.get("website_url")) or _website_url_for_cluster(
                cluster, title=cluster[0].title if cluster else "Untitled", summary=""
            )
            story = StoryPost(
                text=km_text,
                primary_url=website,
                primary_source=primary_source or "Inbound Reports",
                extra_urls=[],
                extra_sources=[],
                image_url=pick_image_url(cluster),
                entry_ids={e.id for e in cluster},
                entry_titles={e.title for e in cluster},
                entries=cluster,
                urgent=bool(payload.get("urgent")),
            )
        except Exception as exc:
            logger.warning("Mirror: direct post translation failed (%s) — falling back to cluster rewrite", exc)
            story = None

    if not story:
        story = _cluster_to_story(
            cluster,
            urgent=bool(payload.get("urgent")),
            website_url=_safe_link(payload.get("website_url")),
        )

    if not story:
        logger.warning("Mirror: story rewrite returned None — will requeue")
        return False, False

    succeeded = await broadcast_stories(context, [story])
    if succeeded:
        _mark_posted([story], succeeded)
        logger.info("Mirror: posted Khmer story (%d entries).", len(cluster))
        return True, False
    logger.warning("Mirror: Telegram send failed for story — will requeue")
    return False, False


async def _mirror_batch(
    context: ContextTypes.DEFAULT_TYPE, payload: dict
) -> tuple[bool, bool]:
    """Returns ``(success, poison)``. Same contract as ``_mirror_story``."""
    stories_in = payload.get("stories") or []
    if not stories_in:
        logger.warning("Mirror: empty batch payload — deadletter (poison)")
        return False, True

    all_ids = _entry_ids_from_batch_payload(stories_in)
    if all_ids and _mirror_already_posted(all_ids):
        logger.info("Mirror: batch already posted on KM — treating as success (idempotent)")
        return True, False

    batched: list[BatchedStory] = []
    for item in stories_in:
        cluster = [payload_to_entry(d) for d in item.get("cluster", [])]
        if not cluster:
            logger.warning("Mirror: batch story missing cluster — will requeue whole batch")
            return False, False

        en_title = str(item.get("title") or "").strip()
        en_summary = str(item.get("summary") or "").strip()
        story: BatchedStory | None = None
        if en_title and en_summary:
            try:
                km_title, km_summary = translate_compact_to_km(en_title, en_summary)
                links = collect_links(cluster)
                website = _safe_link(item.get("website_url")) or _website_url_for_cluster(
                    cluster, title=km_title, summary=km_summary
                )
                story = BatchedStory(
                    title=km_title,
                    summary=km_summary,
                    source_line=_attribution_line(links),
                    website_url=website,
                    image_url=pick_image_url(cluster),
                    entry_ids={e.id for e in cluster},
                    entry_titles={e.title for e in cluster},
                    entries=cluster,
                )
            except Exception as exc:
                logger.warning("Mirror: direct compact translation failed (%s) — falling back to cluster rewrite", exc)
                story = None

        if not story:
            story = _cluster_to_batched(cluster, website_url=_safe_link(item.get("website_url")))

        if not story:
            logger.warning("Mirror: partial batch rewrite — will requeue whole batch")
            return False, False
        batched.append(story)

    if len(batched) != len(stories_in):
        logger.warning(
            "Mirror: incomplete batch (%d/%d) — will requeue",
            len(batched),
            len(stories_in),
        )
        return False, False

    succeeded = await broadcast_batched(context, batched)
    if succeeded:
        _mark_posted_batched(batched, succeeded)
        logger.info("Mirror: posted Khmer batch digest (%d stories).", len(batched))
        return True, False
    logger.warning("Mirror: Telegram send failed for batch — will requeue")
    return False, False
