"""RSS feed fetching, title normalization, clustering, and urgency detection."""

from __future__ import annotations

import concurrent.futures
import html
import logging
import os
import pickle
import random
import re
import subprocess
import sys
import tempfile
import threading
import time
from calendar import timegm
from dataclasses import dataclass
from datetime import UTC, datetime
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
    IMPORTANT_KEYWORDS,
    IMPORTANT_MIN_SOURCES,
    MAX_ENTRY_AGE_HOURS,
    MAX_ITEMS_PER_FEED,
    NEWS_LANGUAGE,
    RSS_FEEDS,
    SPAM_BLOCK_NON_LATIN_SCRIPTS,
    SPAM_FILTER_ENABLED,
    SUMMARY_SIM_WORD_LIMIT,
    TECH_ONLY,
    URGENT_KEYWORDS,
    is_tech_text,
)
from workers.images import is_valid_image_url, resolves_to_private

__all__ = [
    "Entry",
    "cluster_entries",
    "collect_new_entries",
    "extract_image_url",
    "looks_telegram_important",
    "looks_urgent",
    "normalize_title_key",
]

logger = logging.getLogger(__name__)

# Thread-local httpx clients — httpx.Client is not thread-safe
_thread_local = threading.local()


_USER_AGENT = (
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36"
)


def _get_http_client() -> httpx.Client:
    """Return a per-thread httpx.Client instance (no auto-redirects — SSRF-safe)."""
    client = getattr(_thread_local, "client", None)
    if client is None:
        client = httpx.Client(
            timeout=FEED_TIMEOUT_SECONDS,
            follow_redirects=False,
            headers={"User-Agent": _USER_AGENT},
        )
        _thread_local.client = client
    return client


# Lazy thread pool — do not create 60 workers at import (Khmer bot never fetches RSS).
_feed_pool: concurrent.futures.ThreadPoolExecutor | None = None
_feed_pool_lock = threading.Lock()


def _get_feed_pool() -> concurrent.futures.ThreadPoolExecutor:
    global _feed_pool
    if _feed_pool is None:
        with _feed_pool_lock:
            if _feed_pool is None:
                _feed_pool = concurrent.futures.ThreadPoolExecutor(
                    max_workers=min(len(RSS_FEEDS), 60)
                )
    return _feed_pool

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
        dt = datetime.fromtimestamp(timegm(parsed), tz=UTC)
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
    """Heuristic check to catch spam/off-topic content that slips past feed curation.

    Controlled by env:
      SPAM_FILTER_ENABLED (default true) — master switch
      SPAM_BLOCK_NON_LATIN_SCRIPTS (default true) — Arabic/Cyrillic/Hebrew ratio check
    Phone-number and hashtag-stuffing checks always run when the filter is enabled.
    """
    if not SPAM_FILTER_ENABLED:
        return False

    if not title:
        return True

    if SPAM_BLOCK_NON_LATIN_SCRIPTS:
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
    """Pull an image URL from common RSS/Atom media fields, if present.

    Returns only http(s) URLs that pass the private-host SSRF guard.
    """
    def _ok(url: object) -> str | None:
        if isinstance(url, str) and is_valid_image_url(url):
            return url.strip()
        return None

    media_content = getattr(raw_entry, "media_content", None) or raw_entry.get("media_content")
    if media_content:
        for item in media_content:
            url = item.get("url") if isinstance(item, dict) else None
            medium = (item.get("medium") or item.get("type") or "") if isinstance(item, dict) else ""
            if url and (not medium or "image" in str(medium).lower() or str(medium).startswith("image/")):
                ok = _ok(url)
                if ok:
                    return ok
            if url and str(url).lower().endswith((".jpg", ".jpeg", ".png", ".gif", ".webp")):
                ok = _ok(url)
                if ok:
                    return ok

    media_thumbnail = getattr(raw_entry, "media_thumbnail", None) or raw_entry.get("media_thumbnail")
    if media_thumbnail:
        for item in media_thumbnail:
            url = item.get("url") if isinstance(item, dict) else None
            ok = _ok(url)
            if ok:
                return ok

    enclosures = getattr(raw_entry, "enclosures", None) or raw_entry.get("enclosures") or []
    for enc in enclosures:
        href = enc.get("href") or enc.get("url") if isinstance(enc, dict) else None
        enc_type = (enc.get("type") or "") if isinstance(enc, dict) else ""
        if href and str(enc_type).startswith("image/"):
            ok = _ok(href)
            if ok:
                return ok
        if href and str(href).lower().endswith((".jpg", ".jpeg", ".png", ".gif", ".webp")):
            ok = _ok(href)
            if ok:
                return ok

    for field in ("summary", "description", "content"):
        value = raw_entry.get(field) if hasattr(raw_entry, "get") else None
        if value is None:
            value = getattr(raw_entry, field, None)
        if isinstance(value, list) and value:
            value = value[0].get("value", "") if isinstance(value[0], dict) else str(value[0])
        if isinstance(value, str):
            match = _IMG_SRC_RE.search(value)
            if match:
                ok = _ok(match.group(1))
                if ok:
                    return ok

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


# Hard cap on a single feed body. A compromised or misbehaving feed host (or a
# redirect to a huge payload) must not be able to exhaust worker memory.
_MAX_FEED_BYTES: int = int(os.environ.get("MAX_FEED_BYTES", str(8 * 1024 * 1024)))
_MAX_FEED_REDIRECTS = 4


def _feed_url_allowed(url: str) -> bool:
    """Reject non-http(s) and private/loopback destinations before dialing."""
    try:
        parsed = httpx.URL(url)
    except Exception:
        return False
    if parsed.scheme not in ("http", "https"):
        return False
    host = parsed.host or ""
    if not host or resolves_to_private(host):
        return False
    return True


def _fetch_feed(url: str) -> Any:
    """Fetch one RSS feed with a byte cap and per-hop SSRF checks, then parse.

    Redirects are followed manually so an open redirect to cloud metadata or
    an internal host cannot be dialed. Oversized bodies are truncated.
    """
    if not _feed_url_allowed(url):
        raise ValueError(f"feed URL blocked by SSRF guard: {url!r}")

    client = _get_http_client()
    current = url
    resp = None
    for _ in range(_MAX_FEED_REDIRECTS + 1):
        if not _feed_url_allowed(current):
            raise ValueError(f"feed redirect blocked by SSRF guard: {current!r}")
        with client.stream("GET", current) as streamed:
            if streamed.is_redirect:
                location = streamed.headers.get("location")
                if not location:
                    raise ValueError("feed redirect missing Location")
                current = str(httpx.URL(current).join(location))
                continue
            streamed.raise_for_status()
            final_host = streamed.url.host or ""
            if resolves_to_private(final_host):
                raise ValueError(f"feed resolved to a private host: {final_host!r}")
            chunks: list[bytes] = []
            total = 0
            for chunk in streamed.iter_bytes():
                total += len(chunk)
                if total > _MAX_FEED_BYTES:
                    logger.warning(
                        "Feed %s exceeded %d bytes — truncating body.",
                        url,
                        _MAX_FEED_BYTES,
                    )
                    chunks.append(chunk[: len(chunk) - (total - _MAX_FEED_BYTES)])
                    break
                chunks.append(chunk)
            return feedparser.parse(b"".join(chunks))
    raise ValueError(f"feed exceeded {_MAX_FEED_REDIRECTS} redirects: {url!r}")


# Extra seconds of slack on top of the normal per-cycle timeout, to cover
# subprocess startup (re-importing the module) and result pickling/transfer.
_SUBPROCESS_STARTUP_SLACK = 15


def _collect_new_entries_inline(
    posted_ids: set[str], posted_titles: set[str]
) -> tuple[list[Entry], int, int]:
    """The actual fetch-all-feeds-in-parallel logic. Runs inside the isolated
    worker subprocess (see collect_new_entries) so the OS reclaims every byte
    — thread-pool buffers, parsed feed bodies, allocator arenas — the instant
    that process exits. CPython's allocator does not reliably hand freed
    memory back to the OS between cycles, so without this isolation, memory
    use stair-steps upward across repeated in-process cycles until Railway
    OOM-kills the service.
    """
    shuffled = random.sample(RSS_FEEDS, len(RSS_FEEDS))
    futures: dict[concurrent.futures.Future, str] = {
        _get_feed_pool().submit(_fetch_feed, url): url for url in shuffled
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
                logger.warning(
                    "Failed to fetch feed %s (unexpected error)",
                    feed_url,
                    exc_info=True,
                )
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
                if TECH_ONLY and not is_tech_text(f"{title} {raw_summary}"):
                    logger.debug("Skipping non-tech entry: %s", title[:120])
                    continue
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
        logger.info("Global feed timeout after %ds — %d/%d feeds completed, %d entries collected.",
                    global_timeout, completed, total, len(entries))

    return entries, completed, total


def _repo_root() -> str:
    return os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def _subprocess_main() -> None:
    """Child process entry: fetch feeds, write pickle, exit so the OS reclaims RAM."""
    in_path = os.environ["NEWSBOT_COLLECT_IN"]
    out_path = os.environ["NEWSBOT_COLLECT_OUT"]
    with open(in_path, "rb") as fh:
        posted_ids, posted_titles = pickle.load(fh)
    try:
        entries, completed, total = _collect_new_entries_inline(posted_ids, posted_titles)
        payload = ("ok", entries, completed, total)
    except Exception:
        logger.exception("Feed collection worker crashed")
        payload = ("error", [], 0, 0)
    with open(out_path, "wb") as fh:
        pickle.dump(payload, fh, protocol=pickle.HIGHEST_PROTOCOL)


def collect_new_entries(posted_ids: set[str], posted_titles: set[str] | None = None) -> list[Entry]:
    """Pull fresh entries from all feeds in parallel, skipping already-posted IDs and similar titles.

    English bot only. The Khmer deployment drains the Redis mirror and must
    never poll RSS.

    Digest jobs run inside ``asyncio.to_thread``, so ``multiprocessing.Process``
    (spawn) from that worker thread hangs on Railway. This uses ``subprocess``
    (safe from any thread): a one-shot ``python -c`` child fetches, pickles,
    and exits so the OS reclaims the feed buffers.
    """
    if posted_titles is None:
        posted_titles = set()

    if NEWS_LANGUAGE != "en":
        logger.warning(
            "Skipping RSS collection on NEWS_LANGUAGE=%s — English ingest only; "
            "Khmer posts come from the mirror queue.",
            NEWS_LANGUAGE,
        )
        return []

    global_timeout = FEED_TIMEOUT_SECONDS + FEED_GLOBAL_TIMEOUT_EXTRA
    timeout = global_timeout + _SUBPROCESS_STARTUP_SLACK
    in_path = out_path = ""
    try:
        with tempfile.NamedTemporaryFile(prefix="inbound-feeds-in-", suffix=".pkl", delete=False) as fh:
            pickle.dump((posted_ids, posted_titles), fh, protocol=pickle.HIGHEST_PROTOCOL)
            in_path = fh.name
        out_path = in_path + ".out"
        env = os.environ.copy()
        env["NEWSBOT_COLLECT_IN"] = in_path
        env["NEWSBOT_COLLECT_OUT"] = out_path
        env.setdefault("NEWS_LANGUAGE", "en")
        result = subprocess.run(
            [
                sys.executable,
                "-c",
                "from newsbot.feeds import _subprocess_main; _subprocess_main()",
            ],
            cwd=_repo_root(),
            env=env,
            timeout=timeout,
            capture_output=True,
            check=False,
        )
        if result.stderr:
            err = result.stderr.decode("utf-8", errors="replace").strip()
            if err:
                logger.info("Feed worker log:\n%s", err[-4000:])
        if result.returncode != 0:
            logger.warning(
                "Feed collection worker exited %s — 0 entries this cycle.",
                result.returncode,
            )
            return []
        if not os.path.exists(out_path):
            logger.warning("Feed collection worker produced no output file — skipping this cycle.")
            return []
        with open(out_path, "rb") as fh:
            status, entries, completed, total = pickle.load(fh)
        if status == "error":
            logger.warning("Feed collection worker reported an internal error — 0 entries this cycle.")
            return []
        logger.info(
            "Feed cycle done via isolated worker — %d/%d feeds completed, %d entries.",
            completed, total, len(entries),
        )
        return entries
    except subprocess.TimeoutExpired:
        logger.warning(
            "Feed collection worker produced no result within %ds — skipping this cycle.",
            timeout,
        )
        return []
    except Exception:
        logger.exception("Feed collection worker failed to start — skipping this cycle.")
        return []
    finally:
        for path in (in_path, out_path):
            if path:
                try:
                    os.unlink(path)
                except OSError:
                    pass


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
    """Rare ASAP Telegram interrupt — must-know keyword hits only."""
    blob = " ".join(f"{e.title} {e.summary}" for e in entries).lower()
    return any(kw in blob for kw in URGENT_KEYWORDS)


def looks_telegram_important(entries: list[Entry]) -> bool:
    """Worthy of the Telegram channel (urgent ASAP or Brief-slot pulse).

    Everything else stays on the website Brief / story pages only.
    """
    if not entries:
        return False
    if looks_urgent(entries):
        return True
    if len(entries) >= IMPORTANT_MIN_SOURCES:
        return True
    blob = " ".join(f"{e.title} {e.summary}" for e in entries).lower()
    return any(kw in blob for kw in IMPORTANT_KEYWORDS)