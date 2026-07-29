"""Configuration constants and environment variable loading.

Feed Tier System:
  Tier 1 (this file): ~130 curated feeds — Telegram bot (fast, reliable, <15s)
  Tier 2 (feeds_bulk.txt): ~4,400 feeds — website ingestion pipeline (future)
  Tier 3 (APIs): GDELT, NewsData.io, Guardian, NYTimes — website ingestion (future)

The Telegram bot only fetches Tier 1 feeds. Tier 2/3 are for the website
at inboundreports.com and are not loaded by the bot.
"""

from __future__ import annotations

import os
from zoneinfo import ZoneInfo

from dotenv import load_dotenv

load_dotenv()

__all__ = [
    "validate_config",
    "create_groq_client",
    "create_gemini_client",
    "GEMINI_MODEL",
    "create_openrouter_client",
    "OPENROUTER_MODEL",
    "REDIS_URL",
    "RSS_FEEDS",
    "MAX_ITEMS_PER_FEED",
    "MAX_ENTRY_AGE_HOURS",
    "FEED_TIMEOUT_SECONDS",
    "CLUSTER_SIMILARITY_THRESHOLD",
    "CLUSTER_TITLE_WEIGHT",
    "CLUSTER_SUMMARY_WEIGHT",
    "CONTENT_DEDUP_THRESHOLD",
    "GROQ_MODEL",
    "GROQ_BASE_URL",
    "GROQ_MAX_TOKENS",
    "TIMEZONE",
    "DIGEST_MIN_SOURCES",
    "DIGEST_MAX_STORIES",
    "DIGEST_SCHEDULE_HOUR_AM",
    "DIGEST_SCHEDULE_HOUR_PM",
    "DONATION_SCHEDULE_HOUR",
    "DONATION_QR_IMAGE",
    "DONATION_TEXT",
    "DIGEST_HEADER_TEXT",
    "URGENT_CHECK_INTERVAL_SECONDS",
    "URGENT_FIRST_DELAY_SECONDS",
    "MAX_URGENT_POSTS_PER_RUN",
    "URGENT_KEYWORDS",
    "URGENCY_LEVELS",
    "NEWS_CATEGORIES",
    "DISABLE_POSTING",
    "POSTED_LOG",
    "SUBSCRIBERS_LOG",
    "FETCH_COOLDOWN_SECONDS",
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
]

# ---- Redis (optional — enables persistent state on Railway/Render) ----
REDIS_URL: str = os.environ.get("REDIS_URL", "").strip()

# ---- RSS (loaded from sources.yaml via source_registry) ----
from newsbot.source_registry import get_rss_feeds as _get_rss_feeds
RSS_FEEDS: list[str] = _get_rss_feeds(tier=1)

MAX_ITEMS_PER_FEED: int = int(os.environ.get("MAX_ITEMS_PER_FEED", "3"))
MAX_ENTRY_AGE_HOURS: int = int(os.environ.get("MAX_ENTRY_AGE_HOURS", "24"))
FEED_TIMEOUT_SECONDS: int = int(os.environ.get("FEED_TIMEOUT_SECONDS", "10"))
FEED_GLOBAL_TIMEOUT_EXTRA: int = 50

# ---- Clustering ----
CLUSTER_SIMILARITY_THRESHOLD: float = float(os.environ.get("CLUSTER_SIMILARITY_THRESHOLD", "0.45"))
CLUSTER_TITLE_WEIGHT: float = float(os.environ.get("CLUSTER_TITLE_WEIGHT", "0.7"))
CLUSTER_SUMMARY_WEIGHT: float = float(os.environ.get("CLUSTER_SUMMARY_WEIGHT", "0.3"))
CONTENT_DEDUP_THRESHOLD: float = float(os.environ.get("CONTENT_DEDUP_THRESHOLD", "0.65"))
SUMMARY_SIM_WORD_LIMIT: int = 100

# ---- AI ----
GROQ_MODEL: str = "llama-3.3-70b-versatile"
GROQ_BASE_URL: str = "https://api.groq.com/openai/v1"
GROQ_MAX_TOKENS: int = 2200
AI_HTTP_TIMEOUT_SECONDS: float = float(os.environ.get("AI_HTTP_TIMEOUT_SECONDS", "30"))
PREPARE_ENTRIES_TIMEOUT_SECONDS: float = float(
    os.environ.get("PREPARE_ENTRIES_TIMEOUT_SECONDS", "300")
)

# ---- Spam filter ----
SPAM_FILTER_ENABLED: bool = os.environ.get("SPAM_FILTER_ENABLED", "true").lower() in (
    "1", "true", "yes", "on",
)
# Default true: block Arabic/Cyrillic/Hebrew-dominated titles. Set false to reduce false positives.
SPAM_BLOCK_NON_LATIN_SCRIPTS: bool = os.environ.get(
    "SPAM_BLOCK_NON_LATIN_SCRIPTS", "true"
).lower() in ("1", "true", "yes", "on")

# ---- Scheduling ----
TIMEZONE = ZoneInfo("Asia/Phnom_Penh")
DIGEST_MIN_SOURCES: int = 2
DIGEST_MAX_STORIES: int = 10
DIGEST_SCHEDULE_HOUR_AM: int = int(os.environ.get("DIGEST_SCHEDULE_HOUR_AM", "5"))
DIGEST_SCHEDULE_HOUR_PM: int = int(os.environ.get("DIGEST_SCHEDULE_HOUR_PM", "17"))
DONATION_SCHEDULE_HOUR: int = int(os.environ.get("DONATION_SCHEDULE_HOUR", "22"))  # 10 PM
DONATION_QR_IMAGE: str = os.environ.get("DONATION_QR_IMAGE", "qr_aba_news.jpg")
_DEFAULT_DONATION_TEXT = (
    "<b>Support Inbound Reports</b>\n\n"
    "We aggregate tech news from multiple sources and APIs across the web "
    "to deliver concise, multi-perspective coverage.\n\n"
    "Running this engine takes resources. "
    "If you find value in having a balanced tech feed, consider supporting our work:\n\n"
    '<a href="https://pay.ababank.com/oRF8/puropy03">ABA Payment Link</a>'
)
DONATION_TEXT: str = os.environ.get("DONATION_TEXT", "").strip() or _DEFAULT_DONATION_TEXT
DIGEST_HEADER_TEXT: str = os.environ.get(
    "DIGEST_HEADER_TEXT", "📰 <b>Inbound Reports</b>"
).strip() or "📰 <b>Inbound Reports</b>"
URGENT_CHECK_INTERVAL_SECONDS: int = 60 * 30  # every 30 minutes
URGENT_FIRST_DELAY_SECONDS: int = 60
POLL_INTERVAL_SECONDS: int = int(os.environ.get("POLL_INTERVAL_SECONDS", "7200"))

# ---- Rate limiting ----
MAX_URGENT_POSTS_PER_RUN: int = 2
FETCH_COOLDOWN_SECONDS: int = 300  # 5 minutes

# ---- Link caps ----
LINK_CAP_URGENT: int = 3
LINK_CAP_NORMAL: int = 5

# ---- Batching ----
BATCH_STORIES: bool = True
BATCH_MAX_STORIES: int = 6
BATCH_POLL_INTERVAL_MINUTES: int = 180
URGENT_POST_IMMEDIATELY: bool = True

# ---- Feature toggles ----
DISABLE_POSTING: bool = False

# ---- Urgency keywords ----
URGENT_KEYWORDS: tuple[str, ...] = (
    "zero-day", "0-day", "critical vulnerability", "rce", "exploit",
    "data breach", "ransomware", "outage", "down globally", "major outage",
    "security incident", "product recall", "actively exploited",
    "emergency patch", "widespread outage", "breach", "cve", "downtime",
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
POSTED_LOG: str = "posted_ids.json"
SUBSCRIBERS_LOG: str = "subscribers.json"

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

    required_vars = ["TELEGRAM_BOT_TOKEN", "GROQ_API_KEY"]
    missing = [v for v in required_vars if not os.environ.get(v)]
    if missing:
        raise SystemExit(f"Missing required env vars: {', '.join(missing)}. Set them in Railway → Variables tab.")

    TELEGRAM_BOT_TOKEN = os.environ["TELEGRAM_BOT_TOKEN"]
    PORT = int(os.environ.get("PORT", "10000"))

    channel_raw = os.environ.get("TELEGRAM_CHANNEL_ID", "").strip()
    if channel_raw:
        try:
            TELEGRAM_CHANNEL_ID = int(channel_raw)
        except (ValueError, TypeError):
            raise SystemExit(f"Invalid TELEGRAM_CHANNEL_ID: {channel_raw!r} — must be an integer.")

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


def create_groq_client():
    """Create and return the OpenAI-compatible Groq client."""
    from openai import OpenAI

    return OpenAI(
        api_key=os.environ["GROQ_API_KEY"],
        base_url=GROQ_BASE_URL,
    )


GEMINI_MODEL: str = "gemini-2.0-flash"


def create_gemini_client():
    """Create and return the Gemini client, or None if GOOGLE_GEMINI_API_KEY is unset.

    Unlike create_groq_client(), this never raises — Gemini is a fallback,
    so a missing key should just mean "fallback unavailable", not a crash.
    """
    api_key = os.environ.get("GOOGLE_GEMINI_API_KEY", "").strip()
    if not api_key:
        return None
    try:
        from google import genai

        return genai.Client(api_key=api_key)
    except Exception:
        import logging

        logging.getLogger(__name__).exception("Failed to create Gemini client")
        return None


OPENROUTER_MODEL: str = os.environ.get(
    "OPENROUTER_MODEL", "meta-llama/llama-3.3-70b-instruct:free"
)
# NOTE: OpenRouter's free-model lineup rotates — a specific model (e.g. DeepSeek)
# can lose its :free tier with no notice. Check https://openrouter.ai/models
# (filter: Price = Free) periodically and override via OPENROUTER_MODEL env var
# if this default stops working.
OPENROUTER_BASE_URL: str = "https://openrouter.ai/api/v1"


def create_openrouter_client():
    """Create and return an OpenAI-compatible OpenRouter client, or None if
    OPENROUTER_API_KEY is unset. Last-resort fallback (free-tier LLM),
    so a missing key should mean "unavailable", not a crash.
    """
    api_key = os.environ.get("OPENROUTER_API_KEY", "").strip()
    if not api_key:
        return None
    try:
        from openai import OpenAI

        return OpenAI(api_key=api_key, base_url=OPENROUTER_BASE_URL)
    except Exception:
        import logging

        logging.getLogger(__name__).exception("Failed to create OpenRouter client")
        return None