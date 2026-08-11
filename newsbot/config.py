"""Configuration constants and environment variable loading.

Feed Tier System:
  Tier 1 intent: curated feeds for the Telegram bot (fast, reliable).
  Tier 2: broader website ingestion set.
  Tier 3: APIs / deep research.

Note: sources.yaml currently tags most RSS as tier [1, 2]. The Telegram bot
therefore loads a capped curated subset via get_bot_rss_feeds(BOT_MAX_FEEDS)
instead of every tier-1 URL.
"""

from __future__ import annotations

import logging
import os
from zoneinfo import ZoneInfo

from dotenv import load_dotenv

load_dotenv()

__all__ = [
    "validate_config",
    "REDIS_URL",
    "RSS_FEEDS",
    "MAX_ITEMS_PER_FEED",
    "MAX_ENTRY_AGE_HOURS",
    "FEED_TIMEOUT_SECONDS",
    "CLUSTER_SIMILARITY_THRESHOLD",
    "CLUSTER_TITLE_WEIGHT",
    "CLUSTER_SUMMARY_WEIGHT",
    "CONTENT_DEDUP_THRESHOLD",
    "GROQ_MAX_TOKENS",
    "TIMEZONE",
    "DIGEST_MIN_SOURCES",
    "DIGEST_MAX_STORIES",
    "DONATION_SCHEDULE_HOUR",
    "DONATION_SCHEDULE_DAYS",
    "DONATION_QR_IMAGE",
    "DONATION_TEXT",
    "donation_text",
    "BRIEF_SCHEDULE_HOURS",
    "brief_button_label",
    "DIGEST_HEADER_TEXT",
    "URGENT_CHECK_INTERVAL_SECONDS",
    "URGENT_FIRST_DELAY_SECONDS",
    "MAX_URGENT_POSTS_PER_RUN",
    "URGENT_KEYWORDS",
    "IMPORTANT_KEYWORDS",
    "IMPORTANT_MIN_SOURCES",
    "URGENCY_LEVELS",
    "NEWS_CATEGORIES",
    "DISABLE_POSTING",
    "POSTED_LOG",
    "SUBSCRIBERS_LOG",
    "FETCH_COOLDOWN_SECONDS",
    "FETCH_GLOBAL_COOLDOWN_SECONDS",
    "FETCH_ADMIN_CHAT_IDS",
    "MAX_SUBSCRIBERS",
    "INSTANCE_LOCK_HEARTBEAT_SECONDS",
    "LINK_CAP_URGENT",
    "LINK_CAP_NORMAL",
    "PREPARE_ENTRIES_TIMEOUT_SECONDS",
    "AI_HTTP_TIMEOUT_SECONDS",
    "SPAM_FILTER_ENABLED",
    "SPAM_BLOCK_NON_LATIN_SCRIPTS",
    "TELEGRAM_BOT_TOKEN",
    "PORT",
    "TELEGRAM_CHANNEL_ID",
    "TELEGRAM_THREAD_ID",
    "TELEGRAM_GROUP_CHAT_ID",
    "WEBSITE_BASE_URL",
    "NEWS_LANGUAGE",
]

def _env_int(name: str, default: int) -> int:
    """Read an int env var, falling back to the default on a bad value.

    Prevents a single typo in a Railway variable from crash-looping the worker;
    the bad value is logged and the safe default is used instead.
    """
    raw = os.environ.get(name)
    if raw is None or raw.strip() == "":
        return default
    try:
        return int(raw)
    except (ValueError, TypeError):
        logging.getLogger(__name__).warning(
            "Invalid %s=%r — using default %d.", name, raw, default
        )
        return default


def _env_float(name: str, default: float) -> float:
    raw = os.environ.get(name)
    if raw is None or raw.strip() == "":
        return default
    try:
        return float(raw)
    except (ValueError, TypeError):
        logging.getLogger(__name__).warning(
            "Invalid %s=%r — using default %s.", name, raw, default
        )
        return default


# ---- Redis (optional — enables persistent state on Railway/Render) ----
REDIS_URL: str = os.environ.get("REDIS_URL", "").strip()

# ---- RSS (curated subset — sources.yaml tags almost all RSS as tier [1,2]) ----
from newsbot.source_registry import get_bot_rss_feeds as _get_bot_rss_feeds

BOT_MAX_FEEDS: int = _env_int("BOT_MAX_FEEDS", 130)
RSS_FEEDS: list[str] = _get_bot_rss_feeds(limit=BOT_MAX_FEEDS)

MAX_ITEMS_PER_FEED: int = _env_int("MAX_ITEMS_PER_FEED", 3)
MAX_ENTRY_AGE_HOURS: int = _env_int("MAX_ENTRY_AGE_HOURS", 24)
FEED_TIMEOUT_SECONDS: int = _env_int("FEED_TIMEOUT_SECONDS", 10)
FEED_GLOBAL_TIMEOUT_EXTRA: int = _env_int("FEED_GLOBAL_TIMEOUT_EXTRA", 50)

# ---- Clustering ----
CLUSTER_SIMILARITY_THRESHOLD: float = _env_float("CLUSTER_SIMILARITY_THRESHOLD", 0.45)
CLUSTER_TITLE_WEIGHT: float = _env_float("CLUSTER_TITLE_WEIGHT", 0.7)
CLUSTER_SUMMARY_WEIGHT: float = _env_float("CLUSTER_SUMMARY_WEIGHT", 0.3)
CONTENT_DEDUP_THRESHOLD: float = _env_float("CONTENT_DEDUP_THRESHOLD", 0.65)
SUMMARY_SIM_WORD_LIMIT: int = 100

# ---- AI ----
# Model names live in the environment and are read directly by shared.ai_router
# (GROQ_MODEL / OPENROUTER_MODEL / GEMINI_MODEL). No module-level constants here.
GROQ_MAX_TOKENS: int = 2200
AI_HTTP_TIMEOUT_SECONDS: float = _env_float("AI_HTTP_TIMEOUT_SECONDS", 30)
PREPARE_ENTRIES_TIMEOUT_SECONDS: float = _env_float("PREPARE_ENTRIES_TIMEOUT_SECONDS", 300)

# ---- Spam filter ----
SPAM_FILTER_ENABLED: bool = os.environ.get("SPAM_FILTER_ENABLED", "true").lower() in (
    "1", "true", "yes", "on",
)
# Default true: block Arabic/Cyrillic/Hebrew-dominated titles. Set false to reduce false positives.
SPAM_BLOCK_NON_LATIN_SCRIPTS: bool = os.environ.get(
    "SPAM_BLOCK_NON_LATIN_SCRIPTS", "true"
).lower() in ("1", "true", "yes", "on")

# ---- Language ----
# News content language for Telegram posts: "en" or "km" (Khmer).
# All UI copy (badges, buttons, headers, replies) matches the English bot;
# only the translated news content differs.
# Two bot deployments can share this codebase — each sets NEWS_LANGUAGE.
NEWS_LANGUAGE: str = (os.environ.get("NEWS_LANGUAGE", "en").strip().lower() or "en")
if NEWS_LANGUAGE not in ("en", "km"):
    NEWS_LANGUAGE = "en"

# ---- Scheduling ----
TIMEZONE = ZoneInfo("Asia/Phnom_Penh")
DIGEST_MIN_SOURCES: int = 2
DIGEST_MAX_STORIES: int = 10
DONATION_SCHEDULE_HOUR: int = _env_int("DONATION_SCHEDULE_HOUR", 22)  # 10 PM


def _parse_donation_days(raw: str) -> tuple[int, ...]:
    parts = [p.strip() for p in (raw or "").split(",") if p.strip()]
    days: list[int] = []
    for p in parts:
        try:
            d = int(p)
        except ValueError:
            continue
        if 0 <= d <= 6 and d not in days:
            days.append(d)
    return tuple(days) if days else (5,)  # Saturday


# Saturday only (datetime.weekday: Mon=0 … Sun=6). Both EN and KM bots schedule this.
DONATION_SCHEDULE_DAYS: tuple[int, ...] = _parse_donation_days(
    os.environ.get("DONATION_SCHEDULE_DAYS", "5")
)
DONATION_QR_IMAGE: str = os.environ.get("DONATION_QR_IMAGE", "qr_aba_news.jpg")
_DEFAULT_DONATION_TEXT = (
    "<b>Support Inbound Reports</b>\n\n"
    "We aggregate tech news from multiple sources and APIs across the web "
    "to deliver concise, multi-perspective coverage.\n\n"
    "Running this engine takes resources. "
    "If you find value in having a balanced tech feed, consider supporting our work:\n\n"
    '<a href="https://pay.ababank.com/oRF8/puropy03">ABA Payment Link</a>'
)
# Polished Khmer caption (restored from pre-simplify donation copy).
_DEFAULT_DONATION_TEXT_KM = (
    "<b>ចូលរួមជាមួយយើង ដើម្បីស្វែងយល់ពីរឿងរ៉ាវគ្រប់ជ្រុងជ្រោយ</b>\n\n"
    "Inbound Reports មិនពឹងផ្អែកលើទស្សនៈតែមួយឡើយ។\n"
    "វេទិការបស់យើងប្រមូលព័ត៌មានបច្ចេកវិទ្យា\n"
    "ពីប្រភពចម្រុះ និង APIs ពីបណ្តាញអ៊ីនធឺណិត\n"
    "ដើម្បីដាក់គ្រប់មុខមាត់ទាំងអស់នៅកន្លែងតែមួយ។\n\n"
    "<b>អត្ថប្រយោជន៍៖</b>\n\n"
    "ចៀសផុតពីភាពរញ៉េរញ៉ៃ\n"
    "   និងមិនជាប់ក្នុងបន្ទប់ព័ត៌មានតែមួយ\n\n"
    "ទទួលបានទស្សនៈតុល្យភាព\n"
    "   ជុំវិញវិស័យបច្ចេកវិទ្យា\n\n"
    "ស្វែងយល់សាច់រឿងពេញលេញ\n"
    "   ដើម្បីអក្ខរកម្មឌីជីថល\n\n"
    "<b>ការដំណើរការប្រព័ន្ធនេះត្រូវការធនធាន។</b>\n"
    "ប្រសិនបើលោកអ្នកឱ្យតម្លៃវេទិកាព័ត៌មាន\n"
    "ដែលផ្តល់តុល្យភាព និងប្រភពចម្រុះ\n"
    "សូមចូលរួមគាំទ្រការងាររបស់យើង!\n\n"
    "<b>វិភាគទានតាម ABA៖</b>\n\n"
    '<a href="https://pay.ababank.com/oRF8/puropy03">ចុចទីនេះដើម្បីបរិច្ចាក</a>'
)


def donation_text() -> str:
    """Weekly donation caption for this deployment (EN or KM via NEWS_LANGUAGE)."""
    if NEWS_LANGUAGE == "km":
        return os.environ.get("DONATION_TEXT_KM", "").strip() or _DEFAULT_DONATION_TEXT_KM
    return os.environ.get("DONATION_TEXT", "").strip() or _DEFAULT_DONATION_TEXT


DONATION_TEXT: str = os.environ.get("DONATION_TEXT", "").strip() or _DEFAULT_DONATION_TEXT

# Dedicated Daily Brief slots (Asia/Phnom_Penh). English bot posts a multi-story
# batched digest; Khmer receives the same batch via Redis mirror.
def _parse_brief_hours(raw: str) -> tuple[int, ...]:
    parts = [p.strip() for p in (raw or "").split(",") if p.strip()]
    hours: list[int] = []
    for p in parts:
        try:
            h = int(p)
        except ValueError:
            continue
        if 0 <= h <= 23 and h not in hours:
            hours.append(h)
    return tuple(hours) if hours else (6, 12, 18, 22)


BRIEF_SCHEDULE_HOURS: tuple[int, ...] = _parse_brief_hours(
    os.environ.get("BRIEF_SCHEDULE_HOURS", "6,12,18,22")
)


def brief_button_label() -> str:
    if NEWS_LANGUAGE == "km":
        return "បើក Brief ថ្ងៃនេះ →"
    return "Open today's Brief →"


_DEFAULT_DIGEST_HEADER = "Inbound Reports"


def _normalize_digest_header(raw: str) -> str:
    """Plain brand name — strip legacy emoji/HTML so the message compiler can wrap once."""
    text = (raw or "").strip()
    if text.startswith("📰"):
        text = text[1:].strip()
    text = text.replace("<b>", "").replace("</b>", "").strip()
    return text or _DEFAULT_DIGEST_HEADER


DIGEST_HEADER_TEXT: str = _normalize_digest_header(
    os.environ.get("DIGEST_HEADER_TEXT", _DEFAULT_DIGEST_HEADER)
)

# Public website base URL — Telegram CTAs link here instead of raw sources.
WEBSITE_BASE_URL: str = (
    os.environ.get("WEBSITE_BASE_URL", "https://inbound-news-web.vercel.app").strip().rstrip("/")
    or "https://inbound-news-web.vercel.app"
)
URGENT_CHECK_INTERVAL_SECONDS: int = 60 * 30  # every 30 minutes
URGENT_FIRST_DELAY_SECONDS: int = 60

# ---- Rate limiting / abuse control ----
MAX_URGENT_POSTS_PER_RUN: int = 2
# Per-chat /fetch cooldown (in-memory) and a process-wide floor so a swarm of
# accounts cannot each trigger a full feed+AI pipeline back to back.
FETCH_COOLDOWN_SECONDS: int = _env_int("FETCH_COOLDOWN_SECONDS", 300)  # 5 minutes
FETCH_GLOBAL_COOLDOWN_SECONDS: int = _env_int("FETCH_GLOBAL_COOLDOWN_SECONDS", 60)
# Cap on /start subscribers to bound broadcast fan-out cost and spam growth.
MAX_SUBSCRIBERS: int = _env_int("MAX_SUBSCRIBERS", 200_000)
# How often the running instance renews its Redis single-instance lock so the
# 15-minute TTL never expires under a long-lived poller (would let a second
# replica start and double-post).
INSTANCE_LOCK_HEARTBEAT_SECONDS: int = _env_int("INSTANCE_LOCK_HEARTBEAT_SECONDS", 300)


def _parse_admin_chat_ids(raw: str) -> frozenset[int]:
    ids: set[int] = set()
    for part in (raw or "").split(","):
        part = part.strip()
        if not part:
            continue
        try:
            ids.add(int(part))
        except ValueError:
            logging.getLogger(__name__).warning("Ignoring non-integer FETCH_ADMIN_CHAT_IDS entry: %r", part)
    return frozenset(ids)


# When set, /fetch is restricted to these chat ids (admins). Empty = open (legacy).
FETCH_ADMIN_CHAT_IDS: frozenset[int] = _parse_admin_chat_ids(
    os.environ.get("FETCH_ADMIN_CHAT_IDS", "")
)

# ---- Link caps ----
LINK_CAP_URGENT: int = 3
LINK_CAP_NORMAL: int = 5

# ---- Batching ----
BATCH_STORIES: bool = True
BATCH_MAX_STORIES: int = 6
# Multi-source clusters are Telegram-worthy even without urgent keywords.
IMPORTANT_MIN_SOURCES: int = _env_int("IMPORTANT_MIN_SOURCES", 2)

# ---- Feature toggles ----
DISABLE_POSTING: bool = False

# ---- Urgency keywords (ASAP Telegram interrupts — keep rare / must-know) ----
URGENT_KEYWORDS: tuple[str, ...] = (
    "zero-day",
    "0-day",
    "critical vulnerability",
    "actively exploited",
    "emergency patch",
    "ransomware",
    "data breach",
    "security incident",
    "major outage",
    "down globally",
    "widespread outage",
    "product recall",
    "massive layoffs",
    "antitrust",
)

# Broader “tech people care” cues for Brief-slot pulse (with multi-source or alone).
IMPORTANT_KEYWORDS: tuple[str, ...] = (
    "acquisition",
    "acquires",
    "merger",
    "ipo",
    "layoffs",
    "laid off",
    "shutdown",
    "shutting down",
    "banned",
    "ban on",
    "antitrust",
    "regulation",
    "regulators",
    "openai",
    "anthropic",
    "nvidia",
    "spacex",
    "apple intelligence",
    "gemini",
    "chatgpt",
    "launching",
    "unveils",
    "open-sources",
    "open sourced",
)

# ---- Template urgency levels ----
URGENCY_LEVELS: tuple[str, ...] = ("breaking", "alert", "analysis", "market", "explainer")
URGENCY_LEVELS_SET: frozenset[str] = frozenset(URGENCY_LEVELS)

# ---- News categories ----
NEWS_CATEGORIES: tuple[str, ...] = (
    "startups", "ai", "cybersecurity", "defi",
    "big_tech", "hardware", "science", "regulation",
    "cloud", "opensource", "gaming", "climate",
    "telecom", "mobile", "regional",
)
NEWS_CATEGORIES_SET: frozenset[str] = frozenset(NEWS_CATEGORIES)

# ---- File paths ----
# Non-English bots use suffixed files so a Khmer and English bot sharing a
# filesystem never collide on state. "en" keeps the legacy names.
_LANG_SUFFIX: str = "" if NEWS_LANGUAGE == "en" else f"_{NEWS_LANGUAGE}"
POSTED_LOG: str = f"posted_ids{_LANG_SUFFIX}.json"
SUBSCRIBERS_LOG: str = f"subscribers{_LANG_SUFFIX}.json"

# ---- Telegram (populated by validate_config) ----
TELEGRAM_BOT_TOKEN: str = ""
PORT: int = 10000
TELEGRAM_CHANNEL_ID: int | None = None
TELEGRAM_THREAD_ID: int | None = None
TELEGRAM_GROUP_CHAT_ID: int | None = None


def validate_config() -> None:
    """Validate required env vars and populate Telegram settings.

    Call once from main() — not at import time.
    """
    global TELEGRAM_BOT_TOKEN, PORT, TELEGRAM_CHANNEL_ID, TELEGRAM_THREAD_ID, TELEGRAM_GROUP_CHAT_ID

    import logging

    _log = logging.getLogger(__name__)

    required_vars = ["TELEGRAM_BOT_TOKEN", "GROQ_API_KEY"]
    missing = [v for v in required_vars if not os.environ.get(v)]
    if missing:
        raise SystemExit(f"Missing required env vars: {', '.join(missing)}. Set them in Railway → Variables tab.")

    TELEGRAM_BOT_TOKEN = os.environ["TELEGRAM_BOT_TOKEN"]
    try:
        PORT = int(os.environ.get("PORT", "10000"))
    except (ValueError, TypeError):
        raise SystemExit(
            f"Invalid PORT: {os.environ.get('PORT', '')!r} — must be an integer."
        )

    channel_raw = os.environ.get("TELEGRAM_CHANNEL_ID", "").strip()
    if channel_raw:
        try:
            TELEGRAM_CHANNEL_ID = int(channel_raw)
        except (ValueError, TypeError):
            raise SystemExit(f"Invalid TELEGRAM_CHANNEL_ID: {channel_raw!r} — must be an integer.")
    else:
        _log.warning(
            "TELEGRAM_CHANNEL_ID unset — digests will only go to /start subscribers, not a channel."
        )

    thread_raw = os.environ.get("TELEGRAM_THREAD_ID", "").strip()
    if thread_raw:
        try:
            TELEGRAM_THREAD_ID = int(thread_raw)
        except (ValueError, TypeError):
            raise SystemExit(f"Invalid TELEGRAM_THREAD_ID: {thread_raw!r} — must be an integer.")

    group_raw = os.environ.get("TELEGRAM_GROUP_CHAT_ID", "").strip()
    if group_raw:
        try:
            TELEGRAM_GROUP_CHAT_ID = int(group_raw)
        except (ValueError, TypeError):
            raise SystemExit(f"Invalid TELEGRAM_GROUP_CHAT_ID: {group_raw!r} — must be an integer.")

    if not REDIS_URL:
        _log.warning(
            "REDIS_URL unset — posted-id state is ephemeral (lost on redeploy). "
            "Set REDIS_URL for production."
        )

    _log.info("Telegram bot RSS feed budget: %d URLs (BOT_MAX_FEEDS=%d)", len(RSS_FEEDS), BOT_MAX_FEEDS)
