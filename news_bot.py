"""Telegram Tech News Bot - v4

Fetches tech RSS headlines from multiple trusted sources, clusters related
stories, rewrites them with AI into a fixed Telegram format, and posts a
multi-story Brief whenever new stories appear, with urgent stories checked
separately and posted anytime.

Schedule:
  - Latest-news trickle: new stories are posted individually as they appear,
    around the clock (DIGEST_CHECK_INTERVAL_SECONDS, default hourly)
  - Daily Brief slots (default 6/12/18/22 local): the batched Brief pipeline
    posts new tech news since the previous slot (up to 6 summaries) on the
    English channel; Khmer mirrors via Redis
  - Urgent keyword check: every URGENT_CHECK_INTERVAL_SECONDS, posts immediately
  - Use /fetch for on-demand individual digests (subject to cooldown)

Setup:
  pip install -e .

Env vars needed — create a .env file in this folder (see .env.example):
    TELEGRAM_BOT_TOKEN     - from @BotFather
    GROQ_API_KEY           - your Groq API key (console.groq.com/keys, free tier)

How people join:
    Anyone sends /start to the bot once. They're saved to subscribers.json
    and get every future news post automatically. /stop unsubscribes.
"""

from __future__ import annotations

import asyncio
import datetime as dt
import logging
import os
import threading
import time as time_mod

from telegram.ext import Application, CommandHandler, ContextTypes, filters

from newsbot import config
from newsbot.ads_admin import register_ads_handlers
from newsbot.bot import (
    _tg_send,
    fetch_and_post,
    fetch_individual_and_post,
    fetch_urgent_and_post,
    mirror_drain_job,
    mirror_outbox_flush_job,
)
from newsbot.brief_cta import raise_if_legacy_brief_cta, warn_legacy_brief_cta_env
from newsbot.config import (
    BRIEF_SCHEDULE_HOURS,
    DIGEST_CHECK_INTERVAL_SECONDS,
    DIGEST_SCHEDULE_HOUR_AM,
    DIGEST_SCHEDULE_HOUR_PM,
    DONATION_QR_IMAGE,
    DONATION_SCHEDULE_DAYS,
    DONATION_SCHEDULE_HOUR,
    FETCH_ADMIN_CHAT_IDS,
    FETCH_COOLDOWN_SECONDS,
    FETCH_GLOBAL_COOLDOWN_SECONDS,
    INSTANCE_LOCK_HEARTBEAT_SECONDS,
    MAX_SUBSCRIBERS,
    TIMEZONE,
    URGENT_CHECK_INTERVAL_SECONDS,
    URGENT_FIRST_DELAY_SECONDS,
    donation_text,
    validate_config,
)
from newsbot.health import start_health_server
from newsbot.mirror import mirror_available
from newsbot.state import (
    acquire_instance_lock,
    get_state,
    refresh_instance_lock,
    release_instance_lock,
)

logging.basicConfig(
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    level=logging.INFO,
)
# httpx logs the full request URL at INFO level, which includes the bot
# token (api.telegram.org/bot<TOKEN>/...). Silence it so the token never
# ends up in logs again.
logging.getLogger("httpx").setLevel(logging.WARNING)

logger = logging.getLogger(__name__)

_fetch_last_run: dict[int, float] = {}
_global_fetch_last_run: float = 0.0
_fetch_cooldown_lock = threading.Lock()


async def urgent_job(context: ContextTypes.DEFAULT_TYPE) -> None:
    """Urgent check — keyword matches not already posted. Runs every URGENT_CHECK_INTERVAL_SECONDS."""
    await fetch_urgent_and_post(context)


async def digest_job(context: ContextTypes.DEFAULT_TYPE) -> None:
    """Trickle digest — post new stories individually as they appear.

    Runs hourly around the clock (default DIGEST_SCHEDULE_HOUR_AM=0 to PM=24)
    on the English bot. Each run posts the latest unposted stories one message
    each; the Khmer bot receives the same stories via the Redis mirror.
    """
    now = dt.datetime.now(TIMEZONE)
    if not (DIGEST_SCHEDULE_HOUR_AM <= now.hour < DIGEST_SCHEDULE_HOUR_PM):
        logger.debug(
            "Digest window closed (now %s, window %02d:00–%02d:00) — skipping.",
            now.strftime("%H:%M"),
            DIGEST_SCHEDULE_HOUR_AM,
            DIGEST_SCHEDULE_HOUR_PM,
        )
        return
    try:
        n = await fetch_individual_and_post(context)
        if n:
            logger.info("Digest trickle posted %d individual stor(y/ies).", n)
    except Exception:
        logger.exception("Digest trickle failed")


async def instance_lock_heartbeat_job(context: ContextTypes.DEFAULT_TYPE) -> None:
    """Renew the Redis single-instance lock so its TTL never lapses mid-run."""
    await asyncio.to_thread(refresh_instance_lock)


async def donation_job(context: ContextTypes.DEFAULT_TYPE) -> None:
    """Send Saturday donation post to this bot's TELEGRAM_CHANNEL_ID.

    English and Khmer are separate Railway services — each posts to its own
    channel, with caption language from NEWS_LANGUAGE.
    """
    from newsbot.bot import _resolve_channel_target

    chat_id, thread_id = _resolve_channel_target()
    if chat_id is None:
        logger.warning(
            "TELEGRAM_CHANNEL_ID not set (NEWS_LANGUAGE=%s) — skipping donation.",
            config.NEWS_LANGUAGE,
        )
        return

    text = donation_text()
    raise_if_legacy_brief_cta(text, field="donation")
    qr_path = DONATION_QR_IMAGE
    kwargs: dict = {"chat_id": chat_id, "parse_mode": "HTML"}
    if thread_id is not None:
        kwargs["message_thread_id"] = thread_id

    try:
        if os.path.isfile(qr_path):
            with open(qr_path, "rb") as f:
                await _tg_send(context.bot.send_photo, photo=f, caption=text, **kwargs)
        else:
            logger.warning("Donation QR image not found at %s — sending text-only.", qr_path)
            await _tg_send(
                context.bot.send_message,
                text=text,
                disable_web_page_preview=True,
                **kwargs,
            )
        logger.info(
            "Donation message sent to chat %s topic %s (lang=%s)",
            chat_id,
            thread_id,
            config.NEWS_LANGUAGE,
        )
    except Exception:
        logger.exception(
            "Failed to send donation message to %s (lang=%s)",
            chat_id,
            config.NEWS_LANGUAGE,
        )


async def brief_job(context: ContextTypes.DEFAULT_TYPE) -> None:
    """Daily Brief slot: post a multi-story Brief of stories since the last slot.

    Runs on the English bot at each BRIEF_SCHEDULE_HOURS and mirrors the batch
    to Redis. Khmer bot is a no-op here — it receives the batch via
    mirror_drain_job. If there is nothing new, skip silently (no CTA card).
    """
    if config.NEWS_LANGUAGE == "km":
        logger.debug("Khmer brief_job no-op — waiting for mirrored EN batch.")
        return

    try:
        n = await fetch_and_post(context)
        if n:
            logger.info("Brief batch posted %d stor(y/ies).", n)
        else:
            logger.info("Brief batch empty — nothing to send.")
    except Exception:
        logger.exception("Brief job failed")


async def _reply(update: object, text: str) -> None:
    """Reply to a Telegram message (works for DMs, groups, and channels)."""
    msg = getattr(update, "effective_message", None)
    if msg:
        await msg.reply_text(text)


async def start_command(update: object, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Subscribe the current chat to future news broadcasts.

    When run inside a group forum topic (e.g. the News topic), the bot records
    that topic and posts future news there instead of the General topic.
    """
    state = get_state()
    subscribers = state.load_subscribers()
    effective_chat = getattr(update, "effective_chat", None)
    chat_id = effective_chat.id if effective_chat else 0
    chat_title = (effective_chat.title or effective_chat.first_name or "unknown") if effective_chat else "unknown"
    logger.info("[/start] chat_id=%s name=%s", chat_id, chat_title)

    msg = getattr(update, "effective_message", None)
    thread_id = getattr(msg, "message_thread_id", None)
    chat_type = getattr(effective_chat, "type", "") if effective_chat else ""
    in_topic = chat_type in ("group", "supergroup") and thread_id is not None
    if in_topic:
        group_threads = state.load_group_threads()
        group_threads[chat_id] = thread_id
        state.save_group_threads(group_threads)
        logger.info(
            "[/start] recorded topic for chat_id=%s thread=%s",
            chat_id,
            thread_id,
        )

    if chat_id not in subscribers:
        if len(subscribers) >= MAX_SUBSCRIBERS:
            logger.warning(
                "[/start] subscriber cap %d reached — rejecting new chat_id=%s",
                MAX_SUBSCRIBERS,
                chat_id,
            )
            await _reply(
                update,
                "We've hit capacity for direct subscribers right now. "
                "Follow the public channel to keep getting the news.",
            )
            return
        subscribers.add(chat_id)
        state.save_subscribers(subscribers)
        if in_topic:
            await _reply(
                update,
                "Subscribed! News will be posted to this topic. "
                "You'll get must-know alerts ASAP, Daily Brief skim at set "
                "times, and a link to the full Brief on the site.",
            )
        else:
            await _reply(
                update,
                "Subscribed! You'll get must-know alerts ASAP, Daily Brief skim "
                "at set times, and a link to the full Brief on the site.",
            )
    else:
        if in_topic:
            await _reply(update, "You're already subscribed. News will be posted to this topic.")
        else:
            await _reply(update, "You're already subscribed.")


async def stop_command(update: object, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Unsubscribe from broadcasts."""
    state = get_state()
    subscribers = state.load_subscribers()
    effective_chat = getattr(update, "effective_chat", None)
    chat_id = effective_chat.id if effective_chat else 0

    if chat_id in subscribers:
        subscribers.discard(chat_id)
        state.save_subscribers(subscribers)
        await _reply(update, "Unsubscribed. Send /start anytime to rejoin.")
    else:
        await _reply(update, "You weren't subscribed.")


async def fetch_command(update: object, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Manual trigger: /fetch — runs a full check now and reports the outcome."""
    effective_chat = getattr(update, "effective_chat", None)
    chat_id = effective_chat.id if effective_chat else 0

    if config.NEWS_LANGUAGE == "km":
        await _reply(
            update,
            "This channel mirrors the English Inbound Reports channel automatically — "
            "news posts appear here moments after they're posted there.",
        )
        return

    # /fetch burns feed + AI quota — require an explicit admin allowlist.
    if not FETCH_ADMIN_CHAT_IDS:
        logger.warning(
            "[/fetch] rejected chat_id=%s — FETCH_ADMIN_CHAT_IDS is not configured",
            chat_id,
        )
        await _reply(
            update,
            "Manual fetch is disabled until operators set FETCH_ADMIN_CHAT_IDS.",
        )
        return
    if chat_id not in FETCH_ADMIN_CHAT_IDS:
        logger.info("[/fetch] rejected non-admin chat_id=%s", chat_id)
        await _reply(update, "This command is limited to the channel operators.")
        return

    global _global_fetch_last_run
    with _fetch_cooldown_lock:
        now = time_mod.time()
        # Prune entries older than the cooldown window so the dict can't grow unbounded.
        cutoff = now - FETCH_COOLDOWN_SECONDS
        stale = [cid for cid, ts in _fetch_last_run.items() if ts < cutoff]
        for cid in stale:
            del _fetch_last_run[cid]
        # Process-wide floor: bounds total feed+AI spend no matter how many
        # distinct chats issue /fetch.
        global_remaining = FETCH_GLOBAL_COOLDOWN_SECONDS - (now - _global_fetch_last_run)
        if global_remaining > 0:
            await _reply(
                update,
                "The bot is already fetching for someone else — try again in a moment.",
            )
            return
        last_run = _fetch_last_run.get(chat_id, 0)
        remaining = FETCH_COOLDOWN_SECONDS - (now - last_run)
        if remaining > 0:
            minutes = int(remaining // 60) + 1
            await _reply(
                update,
                f"Please wait {minutes} minute{'s' if minutes > 1 else ''} before requesting another fetch.",
            )
            return
        _fetch_last_run[chat_id] = now
        _global_fetch_last_run = now

    logger.info("[/fetch] from chat_id=%s", chat_id)
    await _reply(update, "Fetching latest tech news...")

    try:
        posted_count = await fetch_individual_and_post(context)
    except Exception:
        logger.exception("[/fetch] fetch raised for chat_id=%s", chat_id)
        await _reply(update, "Couldn't fetch news right now — something went wrong. Check the logs.")
        return

    if posted_count == 0:
        await _reply(update, "No new updates right now — checked all feeds, nothing new to post.")
    else:
        await _reply(update, f"Posted {posted_count} new stor{'y' if posted_count == 1 else 'ies'}.")


def _add_command(app: Application, name: str, handler: object) -> None:
    """Register a command for DMs/groups and for channel posts."""
    app.add_handler(CommandHandler(name, handler))  # type: ignore[arg-type]
    app.add_handler(CommandHandler(name, handler, filters=filters.UpdateType.CHANNEL_POSTS))  # type: ignore[arg-type]


def deploy_commit_sha(environ: dict[str, str] | None = None) -> str:
    """Best-effort git SHA from common deploy platform env vars."""
    env = environ if environ is not None else os.environ
    for key in ("RAILWAY_GIT_COMMIT_SHA", "SOURCE_COMMIT", "GITHUB_SHA"):
        value = (env.get(key) or "").strip()
        if value:
            return value
    return "unknown"


def schedule_language_jobs(job_queue: object, *, news_language: str) -> list[str]:
    """Register language-specific recurring jobs. Returns job names registered.

    EN: urgent ASAP, mirror outbox flush, and Daily Brief slots.
    KM: mirror_drain only (Brief batches arrive via Redis — never schedule brief_job).
    """
    names: list[str] = []
    is_km = news_language == "km"
    if is_km:
        if not mirror_available():
            logger.warning(
                "Khmer mirror mode requires REDIS_URL shared with the English bot — "
                "no mirroring will happen until it is set."
            )
        job_queue.run_repeating(  # type: ignore[attr-defined]
            mirror_drain_job,
            interval=10,
            name="mirror_drain",
        )
        names.append("mirror_drain")
        logger.info("Khmer mirror mode active — posting from the English bot's queue.")
    else:
        job_queue.run_repeating(  # type: ignore[attr-defined]
            urgent_job,
            interval=URGENT_CHECK_INTERVAL_SECONDS,
            first=URGENT_FIRST_DELAY_SECONDS,
            name="urgent_check",
        )
        names.append("urgent_check")
        # Recover local outbox after Redis blips (EN is the publisher).
        job_queue.run_repeating(  # type: ignore[attr-defined]
            mirror_outbox_flush_job,
            interval=60,
            first=30,
            name="mirror_outbox_flush",
        )
        names.append("mirror_outbox_flush")
        # Latest-news trickle — EN only. Post new stories individually as they
        # appear around the clock, so the channel stays current between Brief
        # slots. The Khmer bot mirrors them via Redis. First run is near-immediate
        # so posts appear within a minute of (re)deploy, then every interval.
        job_queue.run_repeating(  # type: ignore[attr-defined]
            digest_job,
            interval=DIGEST_CHECK_INTERVAL_SECONDS,
            first=60,
            name="digest_trickle",
        )
        names.append("digest_trickle")
        # Daily Brief slots — EN only. Posts a multi-story Brief from the
        # Supabase site pool at each BRIEF_SCHEDULE_HOURS slot and mirrors it
        # to Redis for the Khmer bot. KM must never register brief_* jobs
        # (old builds used those slots to post the Khmer CTA card).
        for hour in BRIEF_SCHEDULE_HOURS:
            name = f"brief_{hour:02d}"
            job_queue.run_daily(  # type: ignore[attr-defined]
                brief_job,
                time=dt.time(hour=hour, minute=0, tzinfo=TIMEZONE),
                name=name,
            )
            names.append(name)
    return names


def main() -> None:
    """Entry point — initialize all subsystems and start the bot."""
    validate_config()
    warn_legacy_brief_cta_env()

    if not acquire_instance_lock():
        raise SystemExit("Another bot instance holds the lock — refusing to start.")

    threading.Thread(target=start_health_server, daemon=True).start()

    app = Application.builder().token(config.TELEGRAM_BOT_TOKEN).build()

    _add_command(app, "start", start_command)
    _add_command(app, "stop", stop_command)
    _add_command(app, "fetch", fetch_command)
    register_ads_handlers(app)

    if config.TELEGRAM_CHANNEL_ID is not None:
        logger.info(
            "Channel target: %s%s",
            config.TELEGRAM_CHANNEL_ID,
            f" thread={config.TELEGRAM_THREAD_ID}" if config.TELEGRAM_THREAD_ID else "",
        )
    else:
        logger.warning("TELEGRAM_CHANNEL_ID not set — only /start subscribers get posts.")

    if app.job_queue is None:
        raise RuntimeError("job_queue must be available (install python-telegram-bot[job-queue])")

    # Renew the single-instance Redis lock before its TTL expires so a second
    # replica can never start and double-post during a long-lived poll.
    app.job_queue.run_repeating(
        instance_lock_heartbeat_job,
        interval=INSTANCE_LOCK_HEARTBEAT_SECONDS,
        first=INSTANCE_LOCK_HEARTBEAT_SECONDS,
        name="instance_lock_heartbeat",
    )

    # Urgent ASAP + continuous news poll on English only. Khmer mirror mode
    # skips its own feed pipeline — it re-posts everything the English bot
    # publishes via mirror_drain.
    is_km = config.NEWS_LANGUAGE == "km"
    schedule_language_jobs(app.job_queue, news_language=config.NEWS_LANGUAGE)
    # Both EN and KM deployments schedule donation — each posts to its own channel.
    app.job_queue.run_daily(
        donation_job,
        time=dt.time(hour=DONATION_SCHEDULE_HOUR, minute=0, tzinfo=TIMEZONE),
        days=DONATION_SCHEDULE_DAYS,  # Saturday
        name="donation",
    )
    redis_configured = bool(os.environ.get("REDIS_URL", "").strip())
    commit_sha = deploy_commit_sha()
    # Canary: proves this build has no Brief CTA fallback (removed on main).
    assert not hasattr(__import__("news_bot"), "_send_brief_cta")
    logger.info(
        "brief_mode=slots deploy_sha=%s NEWS_LANGUAGE=%s "
        "brief_hours=%s trickle=%02d:%02d-%02d:%02d redis_configured=%s timezone=%s",
        commit_sha,
        config.NEWS_LANGUAGE,
        ",".join(str(h) for h in BRIEF_SCHEDULE_HOURS),
        DIGEST_SCHEDULE_HOUR_AM,
        0,
        DIGEST_SCHEDULE_HOUR_PM,
        0,
        redis_configured,
        TIMEZONE,
    )

    if is_km:
        logger.info(
            "Bot running in Khmer mirror mode — re-posts every English bot "
            "publication as it appears (%s). Donation Sat at %02d:00.",
            TIMEZONE,
            DONATION_SCHEDULE_HOUR,
        )
    else:
        logger.info(
            "Bot running. Latest-news trickle %02d:00–%02d:00 (%s, every %d min). "
            "Daily Brief slots at %s. ASAP urgent checks every %ds. "
            "Donation Sat at %02d:00. /fetch for manual individual digest.",
            DIGEST_SCHEDULE_HOUR_AM,
            DIGEST_SCHEDULE_HOUR_PM,
            TIMEZONE,
            DIGEST_CHECK_INTERVAL_SECONDS // 60,
            ",".join(str(h) for h in BRIEF_SCHEDULE_HOURS),
            URGENT_CHECK_INTERVAL_SECONDS,
            DONATION_SCHEDULE_HOUR,
        )

    try:
        app.run_polling(drop_pending_updates=True)
    finally:
        release_instance_lock()


if __name__ == "__main__":
    main()
