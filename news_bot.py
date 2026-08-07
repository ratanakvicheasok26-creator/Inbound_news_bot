"""Telegram Tech News Bot - v4

Fetches tech RSS headlines from multiple trusted sources, clusters related
stories, rewrites them with AI into a fixed Telegram format, and posts
regular digest stories on a fixed schedule, with urgent stories checked
separately and posted anytime.

Schedule:
  - Regular digest: fixed times at DIGEST_SCHEDULE_HOUR_AM / DIGEST_SCHEDULE_HOUR_PM
    (default 5am and 5pm, Asia/Phnom_Penh)
  - Urgent keyword check: every URGENT_CHECK_INTERVAL_SECONDS, posts immediately
  - Use /fetch for on-demand checks (subject to cooldown)

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

import datetime as dt
import logging
import os
import threading
import time as time_mod

from telegram.ext import Application, CommandHandler, ContextTypes, filters

from newsbot.bot import fetch_and_post, fetch_urgent_and_post, mirror_drain_job
from newsbot import config
from newsbot.mirror import mirror_available
from newsbot.config import (
    BATCH_STORIES,
    DIGEST_SCHEDULE_HOUR_AM,
    DIGEST_SCHEDULE_HOUR_PM,
    DONATION_QR_IMAGE,
    DONATION_SCHEDULE_DAYS,
    DONATION_SCHEDULE_HOUR,
    FETCH_COOLDOWN_SECONDS,
    TIMEZONE,
    URGENT_CHECK_INTERVAL_SECONDS,
    URGENT_FIRST_DELAY_SECONDS,
    donation_text,
    validate_config,
)
from newsbot.health import start_health_server
from newsbot.state import acquire_instance_lock, get_state, release_instance_lock

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
_fetch_cooldown_lock = threading.Lock()


async def poll_job(context: ContextTypes.DEFAULT_TYPE) -> None:
    """Scheduled digest job — runs at DIGEST_SCHEDULE_HOUR_AM / PM."""
    await fetch_and_post(context)


async def urgent_job(context: ContextTypes.DEFAULT_TYPE) -> None:
    """Urgent check — keyword matches not already posted. Runs every URGENT_CHECK_INTERVAL_SECONDS."""
    await fetch_urgent_and_post(context)


async def donation_job(context: ContextTypes.DEFAULT_TYPE) -> None:
    """Send Friday donation post to this bot's TELEGRAM_CHANNEL_ID.

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
    qr_path = DONATION_QR_IMAGE
    kwargs: dict = {"chat_id": chat_id, "parse_mode": "HTML"}
    if thread_id is not None:
        kwargs["message_thread_id"] = thread_id

    try:
        if os.path.isfile(qr_path):
            with open(qr_path, "rb") as f:
                await context.bot.send_photo(photo=f, caption=text, **kwargs)
        else:
            logger.warning("Donation QR image not found at %s — sending text-only.", qr_path)
            await context.bot.send_message(
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


async def _reply(update: object, text: str) -> None:
    """Reply to a Telegram message (works for DMs, groups, and channels)."""
    msg = getattr(update, "effective_message", None)
    if msg:
        await msg.reply_text(text)


async def start_command(update: object, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Subscribe the current chat to future news broadcasts."""
    state = get_state()
    subscribers = state.load_subscribers()
    effective_chat = getattr(update, "effective_chat", None)
    chat_id = effective_chat.id if effective_chat else 0
    chat_title = (effective_chat.title or effective_chat.first_name or "unknown") if effective_chat else "unknown"
    logger.info("[/start] chat_id=%s name=%s", chat_id, chat_title)

    am = DIGEST_SCHEDULE_HOUR_AM
    pm = DIGEST_SCHEDULE_HOUR_PM

    def _hour_label(hour: int) -> str:
        h12 = hour % 12 or 12
        return f"{h12}{'am' if hour < 12 else 'pm'}"

    if chat_id not in subscribers:
        subscribers.add(chat_id)
        state.save_subscribers(subscribers)
        await _reply(
            update,
            f"Subscribed! Regular stories post at {_hour_label(am)} and {_hour_label(pm)}. "
            "Urgent alerts send anytime.",
        )
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

    with _fetch_cooldown_lock:
        now = time_mod.time()
        # Prune entries older than the cooldown window so the dict can't grow unbounded.
        cutoff = now - FETCH_COOLDOWN_SECONDS
        stale = [cid for cid, ts in _fetch_last_run.items() if ts < cutoff]
        for cid in stale:
            del _fetch_last_run[cid]
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

    logger.info("[/fetch] from chat_id=%s", chat_id)
    await _reply(update, "Fetching latest tech news...")

    try:
        posted_count = await fetch_and_post(context)
    except Exception:
        logger.exception("[/fetch] fetch_and_post raised for chat_id=%s", chat_id)
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


def main() -> None:
    """Entry point — initialize all subsystems and start the bot."""
    validate_config()

    if not acquire_instance_lock():
        raise SystemExit("Another bot instance holds the lock — refusing to start.")

    threading.Thread(target=start_health_server, daemon=True).start()

    app = Application.builder().token(config.TELEGRAM_BOT_TOKEN).build()

    _add_command(app, "start", start_command)
    _add_command(app, "stop", stop_command)
    _add_command(app, "fetch", fetch_command)

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

    # Digest at fixed AM/PM times (not a repeating interval).
    # Urgent stories keep a separate repeating check.
    # Khmer mirror mode skips its own feed pipeline — it re-posts everything
    # the English bot publishes, so both channels stay in sync.
    is_km = config.NEWS_LANGUAGE == "km"
    if is_km:
        if not mirror_available():
            logger.warning(
                "Khmer mirror mode requires REDIS_URL shared with the English bot — "
                "no mirroring will happen until it is set."
            )
        app.job_queue.run_repeating(
            mirror_drain_job,
            interval=10,
            name="mirror_drain",
        )
        logger.info("Khmer mirror mode active — posting from the English bot's queue.")
    else:
        app.job_queue.run_daily(
            poll_job,
            time=dt.time(hour=DIGEST_SCHEDULE_HOUR_AM, minute=0, tzinfo=TIMEZONE),
            name="digest_am",
        )
        app.job_queue.run_daily(
            poll_job,
            time=dt.time(hour=DIGEST_SCHEDULE_HOUR_PM, minute=0, tzinfo=TIMEZONE),
            name="digest_pm",
        )
        app.job_queue.run_repeating(
            urgent_job,
            interval=URGENT_CHECK_INTERVAL_SECONDS,
            first=URGENT_FIRST_DELAY_SECONDS,
            name="urgent_check",
        )
    # Both EN and KM deployments schedule this — each posts to its own channel.
    app.job_queue.run_daily(
        donation_job,
        time=dt.time(hour=DONATION_SCHEDULE_HOUR, minute=0, tzinfo=TIMEZONE),
        days=DONATION_SCHEDULE_DAYS,  # Friday
        name="donation",
    )

    if is_km:
        logger.info(
            "Bot running in Khmer mirror mode. Donation Fri at %02d:00 (%s). "
            "News posts mirror the English channel automatically.",
            DONATION_SCHEDULE_HOUR,
            TIMEZONE,
        )
    else:
        mode = "batched" if BATCH_STORIES else "individual"
        logger.info(
            "Bot running. %s digest at %02d:00 and %02d:00 (%s). "
            "Donation Fri at %02d:00. Urgent checks every %ds. Use /fetch for on-demand.",
            mode.capitalize(),
            DIGEST_SCHEDULE_HOUR_AM,
            DIGEST_SCHEDULE_HOUR_PM,
            TIMEZONE,
            DONATION_SCHEDULE_HOUR,
            URGENT_CHECK_INTERVAL_SECONDS,
        )

    try:
        app.run_polling(drop_pending_updates=True)
    finally:
        release_instance_lock()


if __name__ == "__main__":
    main()
