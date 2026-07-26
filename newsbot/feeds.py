"""RSS feed fetching, title normalization, clustering, and urgency detection."""

from __future__ import annotations

import concurrent.futures
import html
import logging
import re
import threading
import time
from calendar import timegm
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any

import feedparser
import httpx

from newsbot.config import (
    CLUSTER_SIMILARITY_THRESHOLD,
    CLUSTER_SUMMARY_WEIGHT,
    CLUSTER_TITLE_WEIGHT,
    CONTENT_DEDUP_THRESHOLD,
    FEED_GLOBAL_TIMEOUT_EXTRA,
    FEED_TIMEOUT_SECONDS,
    MAX_ENTRY_AGE_HOURS,
    MAX_ITEMS_PER_FEED,
    RSS_FEEDS,
    SUMMARY_SIM_WORD_LIMIT,
    URGENT_KEYWORDS,
)

__all__ = [
    "Entry",
    "extract_image_url",
    "normalize_title_key",
    "collect_new_entries",
    "cluster_entries",
    "looks_urgent",
]

logger = logging.getLogger(__name__)

# Thread-local httpx clients — httpx.Client is not thread-safe
_thread_local = threading.local()


def _get_http_client() -> httpx.Client:
    """Return a per-thread httpx.Client instance."""
    client = getattr(_thread_local, "client", None)
    if client is None:
        client = httpx.Client(timeout=FEED_TIMEOUT_SECONDS, follow_redirects=True)
        _thread_local.client = client
    return client


# Shared thread pool for parallel feed fetching
_feed_pool = concurrent.futures.ThreadPoolExecutor(max_workers=min(len(RSS_FEEDS), 10))

# Stop words for title normalization
_STOP_WORDS: frozenset[str] = frozenset({
    "a", "an", "the", "and", "or", "to", "of", "in", "on", "for", "with",
    "as", "at", "by", "from", "is", "are", "its", "it", "this", "that",
})

_IMG_SRC_RE = re.compile(
    r'<img[^>]+src=["\']([^"\']+)["\']',
    re.IGNORECASE,
)

_TAG_RE = re.compile(r"<[^>]+>")


def _strip_html(text: str) -> str:
    """Remove HTML tags, collapse whitespace, and decode common entities."""
    text = re.sub(r"<br\s*/?>", "\n", text, flags=re.IGNORECASE)
    text = re.sub(r"</(p|div|li|h[1-6])>", "\n", text, flags=re.IGNORECASE)
    text = _TAG_RE.sub("", text)
    # Drop any dangling unclosed tag left by mid-attribute truncation
    # (e.g. a summary sliced to 500 chars mid `<a href="...`).
    text = re.sub(r"<[^>]*$", "", text)
    # Some feeds double-encode entities (&amp;#x2019; -> &#x2019;), so
    # unescape twice to fully resolve them.
    text = html.unescape(html.unescape(text))
    return re.sub(r"[ \t]+", " ", text).strip()


def _format_entry_date(raw_entry: Any) -> str | None:
    """Extract and format the publication date from an RSS entry as 'Mon DD, YYYY'."""
    parsed = getattr(raw_entry, "published_parsed", None) or getattr(raw_entry, "updated_parsed", None)
    if parsed is None:
        return None
    try:
        dt = datetime.fromtimestamp(timegm(parsed), tz=timezone.utc)
        return dt.strftime("%b %d, %Y")
    except (TypeError, ValueError):
        return None


# Scripts we expect in legitimate tech-news titles: Latin (English) and Khmer.
# A title dominated by other scripts (Arabic/Persian, Cyrillic, etc.) is almost
# certainly not on-topic content from our curated feeds — most likely spam
# that slipped in via an open tag/aggregation feed.
_NON_TARGET_SCRIPT_RE = re.compile(
    r"[\u0600-\u06FF\u0750-\u077F"  # Arabic / Persian
    r"\u0400-\u04FF"                # Cyrillic
    r"\u0590-\u05FF]"               # Hebrew
)

# Common spam-bait patterns: long digit runs (phone numbers), hashtag
# stuffing, repeated punctuation used to game keyword matching.
_PHONE_NUMBER_RE = re.compile(r"\d{7,}")
_HASHTAG_STUFFING_RE = re.compile(r"(#\S+.*){3,}")


def _looks_like_spam(title: str) -> bool:
    """Heuristic check to catch spam/off-topic content that slips past feed curation."""
    if not title:
        return True

    non_target_chars = len(_NON_TARGET_SCRIPT_RE.findall(title))
    if non_target_chars / max(len(title), 1) > 0.15:
        return True

    if _PHONE_NUMBER_RE.search(title):
        return True

    if _HASHTAG_STUFFING_RE.search(title):
        return True

    return False


def _is_entry_too_old(raw_entry: Any, max_age_hours: int = MAX_ENTRY_AGE_HOURS) -> bool:
    """Check if an RSS entry is older than max_age_hours."""
    parsed = getattr(raw_entry, "published_parsed", None) or getattr(raw_entry, "updated_parsed", None)
    if parsed is None:
        return False
    try:
        entry_ts = timegm(parsed)
        age_seconds = time.time() - entry_ts
        return age_seconds > max_age_hours * 3600
    except (TypeError, ValueError):
        return False


@dataclass
class Entry:
    """A single news item from an RSS feed or API source."""

    id: str
    title: str
    summary: str
    link: str
    source_name: str
    image_url: str | None = None
    published_date: str | None = None
    # Optional fields for non-RSS sources (HN, arXiv, GitHub, etc.)
    authors: list[str] | None = None
    score: int | None = None
    comments_count: int | None = None
    tags: list[str] | None = None


def extract_image_url(raw_entry: Any) -> str | None:
    """Pull an image URL from common RSS/Atom media fields, if present."""
    media_content = getattr(raw_entry, "media_content", None) or raw_entry.get("media_content")
    if media_content:
        for item in media_content:
            url = item.get("url") if isinstance(item, dict) else None
            medium = (item.get("medium") or item.get("type") or "") if isinstance(item, dict) else ""
            if url and (not medium or "image" in str(medium).lower() or str(medium).startswith("image/")):
                return url
            if url and str(url).lower().endswith((".jpg", ".jpeg", ".png", ".gif", ".webp")):
                return url

    media_thumbnail = getattr(raw_entry, "media_thumbnail", None) or raw_entry.get("media_thumbnail")
    if media_thumbnail:
        for item in media_thumbnail:
            url = item.get("url") if isinstance(item, dict) else None
            if url:
                return url

    enclosures = getattr(raw_entry, "enclosures", None) or raw_entry.get("enclosures") or []
    for enc in enclosures:
        href = enc.get("href") or enc.get("url") if isinstance(enc, dict) else None
        enc_type = (enc.get("type") or "") if isinstance(enc, dict) else ""
        if href and str(enc_type).startswith("image/"):
            return href
        if href and str(href).lower().endswith((".jpg", ".jpeg", ".png", ".gif", ".webp")):
            return href

    for field in ("summary", "description", "content"):
        value = raw_entry.get(field) if hasattr(raw_entry, "get") else None
        if value is None:
            value = getattr(raw_entry, field, None)
        if isinstance(value, list) and value:
            value = value[0].get("value", "") if isinstance(value[0], dict) else str(value[0])
        if isinstance(value, str):
            match = _IMG_SRC_RE.search(value)
            if match:
                return match.group(1)

    return None


def _normalize_title(title: str) -> list[str]:
    """Lowercase, strip punctuation, drop stop words for clustering."""
    text = title.lower()
    text = re.sub(r"[^a-z0-9\s]", " ", text)
    return [t for t in text.split() if t and t not in _STOP_WORDS]


def _title_similarity(a: str, b: str) -> float:
    """Jaccard similarity over normalized title tokens."""
    sa = set(_normalize_title(a))
    sb = set(_normalize_title(b))
    if not sa or not sb:
        return 0.0
    return len(sa & sb) / len(sa | sb)


def _summary_similarity(a: str, b: str) -> float:
    """Jaccard similarity over normalized summary tokens (capped)."""
    def _norm(text: str) -> set[str]:
        text = text.lower()
        text = re.sub(r"[^a-z0-9\s]", " ", text)
        words = [t for t in text.split() if t and t not in _STOP_WORDS]
        return set(words[:SUMMARY_SIM_WORD_LIMIT])
    sa = _norm(a)
    sb = _norm(b)
    if not sa or not sb:
        return 0.0
    return len(sa & sb) / len(sa | sb)


def normalize_title_key(title: str) -> str:
    """Return a canonical string key for a title used for dedup storage."""
    tokens = _normalize_title(title)
    return " ".join(sorted(tokens))


def _is_title_duplicate(title: str, posted_titles: set[str], threshold: float = CONTENT_DEDUP_THRESHOLD) -> bool:
    """Check if a title is similar enough to any previously posted title."""
    if not posted_titles:
        return False
    tokens = set(_normalize_title(title))
    if not tokens:
        return False
    for posted_key in posted_titles:
        posted_tokens = set(posted_key.split())
        if not posted_tokens:
            continue
        similarity = len(tokens & posted_tokens) / len(tokens | posted_tokens)
        if similarity >= threshold:
            return True
    return False


def _fetch_feed(url: str) -> Any:
    """Fetch a single RSS feed using httpx (real timeout) then parse with feedparser."""
    client = _get_http_client()
    resp = client.get(url)
    resp.raise_for_status()
    return feedparser.parse(resp.text)


def collect_new_entries(posted_ids: set[str], posted_titles: set[str] | None = None) -> list[Entry]:
    """Pull fresh entries from all feeds in parallel, skipping already-posted IDs and similar titles."""
    if posted_titles is None:
        posted_titles = set()

    futures: dict[concurrent.futures.Future, str] = {
        _feed_pool.submit(_fetch_feed, url): url for url in RSS_FEEDS
    }

    entries: list[Entry] = []
    global_timeout = FEED_TIMEOUT_SECONDS + FEED_GLOBAL_TIMEOUT_EXTRA

    completed = 0
    total = len(futures)
    try:
        for future in concurrent.futures.as_completed(futures, timeout=global_timeout):
            feed_url = futures[future]
            try:
                feed = future.result(timeout=FEED_TIMEOUT_SECONDS)
            except concurrent.futures.TimeoutError:
                logger.warning("Feed %s timed out after %ds", feed_url, FEED_TIMEOUT_SECONDS)
                continue
            except httpx.TimeoutException:
                logger.warning("Feed %s HTTP timeout after %ds", feed_url, FEED_TIMEOUT_SECONDS)
                continue
            except httpx.HTTPStatusError as exc:
                status = exc.response.status_code
                if status in (403, 404, 429):
                    logger.debug("Feed %s returned %d (expected for blocked/removed feeds)", feed_url, status)
                else:
                    logger.warning("Feed %s HTTP %d", feed_url, status)
                continue
            except Exception:
                logger.warning("Failed to fetch feed %s (unexpected error)", feed_url)
                continue

            completed += 1
            if feed.bozo and not feed.entries:
                logger.warning("Feed %s returned an error: %s", feed_url, feed.bozo_exception)
                continue

            source_name: str = feed.feed.get("title", feed_url)
            count = 0
            for entry in feed.entries:
                if count >= MAX_ITEMS_PER_FEED:
                    break
                entry_id: str = entry.get("id", entry.link)
                if entry_id in posted_ids:
                    continue
                if _is_entry_too_old(entry):
                    logger.debug("Skipping stale entry: %s", entry.get("title", ""))
                    continue
                title = entry.get("title", "").strip()
                if _is_title_duplicate(title, posted_titles):
                    logger.debug("Skipping duplicate title: %s", title)
                    continue
                if _looks_like_spam(title):
                    logger.warning("Skipping suspected spam entry: %s", title[:100])
                    continue
                raw_summary = _strip_html(entry.get("summary", "") or "")[:500]
                entries.append(Entry(
                    id=entry_id,
                    title=title,
                    summary=raw_summary,
                    link=entry.link,
                    source_name=source_name,
                    image_url=extract_image_url(entry),
                    published_date=_format_entry_date(entry),
                ))
                count += 1
    except TimeoutError:
        logger.warning("Global feed timeout hit after %ds — %d/%d feeds completed, %d entries collected.",
                        global_timeout, completed, total, len(entries))

    return entries


def cluster_entries(
    entries: list[Entry],
    threshold: float = CLUSTER_SIMILARITY_THRESHOLD,
) -> list[list[Entry]]:
    """Group related headlines across feeds using combined title + summary similarity."""
    clusters: list[list[Entry]] = []
    for entry in entries:
        placed = False
        for cluster in clusters:
            title_sim = _title_similarity(entry.title, cluster[0].title)
            summary_sim = _summary_similarity(entry.summary, cluster[0].summary)
            combined = CLUSTER_TITLE_WEIGHT * title_sim + CLUSTER_SUMMARY_WEIGHT * summary_sim
            if combined >= threshold:
                cluster.append(entry)
                placed = True
                break
        if not placed:
            clusters.append([entry])
    return clusters


def looks_urgent(entries: list[Entry]) -> bool:
    """Keyword-based urgency check on combined title + summary text."""
    blob = " ".join(f"{e.title} {e.summary}" for e in entries).lower()
    return any(kw in blob for kw in URGENT_KEYWORDS)