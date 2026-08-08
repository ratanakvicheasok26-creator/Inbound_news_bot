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
    "DONATION_SCHEDULE_DAYS",
    "DONATION_QR_IMAGE",
    "DONATION_TEXT",
    "donation_text",
    "BRIEF_SCHEDULE_HOURS",
    "brief_text",
    "brief_button_label",
    "DIGEST_HEADER_TEXT",
    "URGENT_CHECK_INTERVAL_SECONDS",
    "URGENT_FIRST_DELAY_SECONDS",
    "MAX_URGENT_POSTS_PER_RUN",
    "URGENT_KEYWORDS",
    "IMPORTANT_KEYWORDS",
    "IMPORTANT_MIN_SOURCES",
    "PULSE_MAX_STORIES",
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
    "WEBSITE_BASE_URL",
    "NEWS_LANGUAGE",
]

# ---- Redis (optional — enables persistent state on Railway/Render) ----
REDIS_URL: str = os.environ.get("REDIS_URL", "").strip()

# ---- RSS (curated subset — sources.yaml tags almost all RSS as tier [1,2]) ----
from newsbot.source_registry import get_bot_rss_feeds as _get_bot_rss_feeds

BOT_MAX_FEEDS: int = int(os.environ.get("BOT_MAX_FEEDS", "130"))
RSS_FEEDS: list[str] = _get_bot_rss_feeds(limit=BOT_MAX_FEEDS)

MAX_ITEMS_PER_FEED: int = int(os.environ.get("MAX_ITEMS_PER_FEED", "3"))
MAX_ENTRY_AGE_HOURS: int = int(os.environ.get("MAX_ENTRY_AGE_HOURS", "24"))
FEED_TIMEOUT_SECONDS: int = int(os.environ.get("FEED_TIMEOUT_SECONDS", "10"))
FEED_GLOBAL_TIMEOUT_EXTRA: int = int(os.environ.get("FEED_GLOBAL_TIMEOUT_EXTRA", "50"))

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
DIGEST_SCHEDULE_HOUR_AM: int = int(os.environ.get("DIGEST_SCHEDULE_HOUR_AM", "5"))
DIGEST_SCHEDULE_HOUR_PM: int = int(os.environ.get("DIGEST_SCHEDULE_HOUR_PM", "17"))
DONATION_SCHEDULE_HOUR: int = int(os.environ.get("DONATION_SCHEDULE_HOUR", "22"))  # 10 PM


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

# Dedicated Daily Brief reminders (Asia/Phnom_Penh). Both EN and KM bots post
# to their own channel — complements ranked digests with a catch-up CTA.
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
_DEFAULT_BRIEF_TEXT = (
    "<b>Today's Brief</b>\n\n"
    "Must-know tech hits this channel as it breaks. "
    "Below (and on the site) is a short keep-up skim — "
    "full sources and Local Lens on Inbound Reports.\n\n"
    '<a href="{brief_url}">Open today\'s Brief →</a>'
)
_DEFAULT_BRIEF_TEXT_KM = (
    "<b>សេចក្តីសង្ខេបថ្ងៃនេះ (Brief)</b>\n\n"
    "ព័ត៌មានសំខាន់ៗផ្ញើមកកាន់ឆានែលនេះភ្លាមៗ។ "
    "ខាងក្រោម (និងនៅលើគេហទំព័រ) ជាការត្រួតពិនិត្យរហ័ស — "
    "មានប្រភពពេញលេញ និង Local Lens នៅលើ Inbound Reports។\n\n"
    '<a href="{brief_url}">បើក Brief ថ្ងៃនេះ →</a>'
)


def brief_text(brief_url: str) -> str:
    """Daily Brief reminder caption — language follows NEWS_LANGUAGE."""
    if NEWS_LANGUAGE == "km":
        template = os.environ.get("BRIEF_TEXT_KM", "").strip() or _DEFAULT_BRIEF_TEXT_KM
    else:
        template = os.environ.get("BRIEF_TEXT", "").strip() or _DEFAULT_BRIEF_TEXT
    return template.replace("{brief_url}", brief_url)


def brief_button_label() -> str:
    if NEWS_LANGUAGE == "km":
        return "បើក Brief ថ្ងៃនេះ →"
    return "Open today's Brief →"


_DEFAULT_DIGEST_HEADER = "📰 <b>Inbound Reports</b>"
DIGEST_HEADER_TEXT: str = os.environ.get(
    "DIGEST_HEADER_TEXT", _DEFAULT_DIGEST_HEADER
).strip() or _DEFAULT_DIGEST_HEADER

# Public website base URL — Telegram CTAs link here instead of raw sources.
WEBSITE_BASE_URL: str = (
    os.environ.get("WEBSITE_BASE_URL", "https://inbound-news-web.vercel.app").strip().rstrip("/")
    or "https://inbound-news-web.vercel.app"
)
URGENT_CHECK_INTERVAL_SECONDS: int = 60 * 30  # every 30 minutes
URGENT_FIRST_DELAY_SECONDS: int = 60
POLL_INTERVAL_SECONDS: int = int(os.environ.get("POLL_INTERVAL_SECONDS", "7200"))

# ---- Rate limiting ----
MAX_URGENT_POSTS_PER_RUN: int = 2
FETCH_COOLDOWN_SECONDS: int = 300  # 5 minutes

# ---- Link caps ----
LINK_CAP_URGENT: int = 3
LINK_CAP_NORMAL: int = 5

# ---- Batching / pulse ----
BATCH_STORIES: bool = True
BATCH_MAX_STORIES: int = 6
BATCH_POLL_INTERVAL_MINUTES: int = 180
URGENT_POST_IMMEDIATELY: bool = True
# Brief-slot pulse: short important skim on Telegram; everything else stays on the website.
PULSE_MAX_STORIES: int = int(os.environ.get("PULSE_MAX_STORIES", "4"))
# Multi-source clusters are Telegram-worthy even without urgent keywords.
IMPORTANT_MIN_SOURCES: int = int(os.environ.get("IMPORTANT_MIN_SOURCES", "2"))

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
# Future: paid DeepSeek as additional tier — not wired.
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