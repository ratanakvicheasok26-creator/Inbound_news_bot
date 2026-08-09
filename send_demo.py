"""Standalone script: sends a demo batched digest to the Telegram group chat.

Usage:
    python send_demo.py

This bypasses DISABLE_POSTING (which stays True) so you can preview the format
without running the full bot pipeline.
"""

import asyncio
import logging
import os

from telegram import Bot

from newsbot.config import (
    TELEGRAM_BOT_TOKEN,
    TELEGRAM_CHANNEL_ID,
    TELEGRAM_THREAD_ID,
    TIMEZONE,
    validate_config,
)

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

DEMO_MESSAGE = """📰 <b>Inbound Reports</b> · <i>Aug 08, 2026 · 06:00 PM</i>
─────────────────────────────
💡 <i>Tease only — full coverage + <b>Local Lens (Cambodia)</b> on the <a href="https://inbound-news-web.vercel.app">daily Brief</a>.</i>

🔹 <b>Apple Announces M4 Chip</b>
Apple's M4 brings a 16-core Neural Engine delivering 38 TOPS, a 40% GPU uplift over M3, and up to 128 GB unified memory. The chip targets AI inference workloads and high-end content creation.
<i><a href="https://www.macrumors.com">MacRumors</a> · <a href="https://9to5mac.com">9to5Mac</a></i>

🔹 <b>Google Releases Gemini 3.0</b>
Gemini 3.0 introduces real-time video understanding and a 2M-token context window. Pricing starts at $0.15 per 1K tokens — 40% cheaper than GPT-5.6. The model can analyze live camera feeds for retail and industrial applications.
<i><a href="https://www.theverge.com">The Verge</a> · <a href="https://techcrunch.com">TechCrunch</a></i>

🔹 <b>Critical RCE in libopenssl</b>
A buffer overflow in libopenssl 3.x (CVE-2026-4418) allows remote code execution via crafted TLS handshakes. All major Linux distros have released patches. Federal agencies must remediate within 7 days per CISA BOD-26-02.
<i><a href="https://www.bleepingcomputer.com">BleepingComputer</a> · <a href="https://krebsonsecurity.com">Krebs on Security</a></i>

─────────────────────────────
🌐 <a href="https://inbound-news-web.vercel.app"><b>Open today's Brief on Inbound Reports →</b></a>"""


async def main() -> None:
    validate_config()

    token = os.environ.get("TELEGRAM_BOT_TOKEN") or TELEGRAM_BOT_TOKEN
    if not token:
        logger.error("TELEGRAM_BOT_TOKEN not set.")
        return

    channel_id = TELEGRAM_CHANNEL_ID
    if channel_id is None:
        raw = os.environ.get("TELEGRAM_CHANNEL_ID", "").strip()
        if raw:
            channel_id = int(raw)

    if channel_id is None:
        logger.error("TELEGRAM_CHANNEL_ID not set.")
        return

    thread_id = TELEGRAM_THREAD_ID
    if thread_id is None:
        raw = os.environ.get("TELEGRAM_THREAD_ID", "").strip()
        if raw:
            thread_id = int(raw)

    bot = Bot(token=token)

    kwargs = {
        "chat_id": channel_id,
        "text": DEMO_MESSAGE,
        "parse_mode": "HTML",
        "disable_web_page_preview": False,
    }
    if thread_id is not None:
        kwargs["message_thread_id"] = thread_id

    msg = await bot.send_message(**kwargs)
    logger.info(
        "Demo sent → chat=%s thread=%s message_id=%s",
        channel_id, thread_id, msg.message_id,
    )


if __name__ == "__main__":
    asyncio.run(main())
