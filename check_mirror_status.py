"""Mirror diagnostic tool.

Run:
    venv/bin/python3 check_mirror_status.py [--replay]

Checks environment variables, Redis connection, mirror queue depths,
channel targets, and AI keys. Optionally replays deadletter items.
"""

from __future__ import annotations

import os
import sys

# Ensure repo root is on sys.path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from dotenv import load_dotenv

load_dotenv()

from newsbot.config import NEWS_LANGUAGE, REDIS_URL, TELEGRAM_CHANNEL_ID
from newsbot.mirror import get_queue_stats, mirror_available, replay_deadletter


def main() -> None:
    print("=" * 65)
    print("  INBOUND NEWS BOT — MIRROR DIAGNOSTIC TOOL")
    print("=" * 65)
    print()

    # 1. Environment & Language
    print("1. DEPLOYMENT ENVIRONMENT")
    print(f"   • NEWS_LANGUAGE: {NEWS_LANGUAGE!r}")
    if NEWS_LANGUAGE == "km":
        print("     ✓ Configured as Khmer Mirror Bot (drains EN queue, posts in Khmer)")
    elif NEWS_LANGUAGE == "en":
        print("     ✓ Configured as English Publisher Bot (publishes EN posts to mirror queue)")
    else:
        print(f"     ✗ Invalid NEWS_LANGUAGE={NEWS_LANGUAGE!r} (must be 'en' or 'km')")

    if TELEGRAM_CHANNEL_ID:
        print(f"   • TELEGRAM_CHANNEL_ID: {TELEGRAM_CHANNEL_ID}")
    else:
        print("   • TELEGRAM_CHANNEL_ID: UNSET ✗ (Warning: channel posting is DISABLED!)")
    print()

    # 2. Redis & Queue Status
    print("2. REDIS MIRROR QUEUE STATUS")
    print(f"   • REDIS_URL: {'CONFIGURED' if REDIS_URL else 'NOT SET (Mirroring is DISABLED!)'}")
    if not mirror_available():
        print("     ✗ Mirroring cannot work because REDIS_URL is missing!")
        print("       Set REDIS_URL in both English and Khmer bot environments.")
    else:
        try:
            stats = get_queue_stats()
            if stats["queue"] == -1:
                print("     ✗ REDIS CONNECTION ERROR / TIMEOUT!")
                print("       Could not connect to Redis server (connection timed out).")
                print("       Verify host, port, credentials, and network/Upstash status.")
            else:
                print(f"   • Live Queue (waiting to drain): {stats['queue']}")
                print(f"   • In-Flight (processing):         {stats['processing']}")
                print(f"   • Deadletter (exhausted/failed):  {stats['deadletter']}")
                print(f"   • Local Outbox File Exists:       {stats['outbox_exists']}")
                print()

                if stats['deadletter'] > 0:
                    print(f"   ⚠ WARNING: {stats['deadletter']} item(s) sit in the deadletter queue.")
                    if "--replay" in sys.argv:
                        replayed = replay_deadletter(max_items=stats['deadletter'])
                        print(f"   ✓ Replayed {replayed} deadletter payload(s) back into the live queue.")
                    else:
                        print("     Run 'venv/bin/python3 check_mirror_status.py --replay' to move them back to the live queue.")
        except Exception as exc:
            print(f"     ✗ REDIS ERROR: {exc}")

    print()

    # 3. AI Router Status
    print("3. AI TRANSLATION PROVIDER STATUS")
    try:
        from shared.ai_router import get_router
        router = get_router()
        ai_status = router.get_status()
        for provider_name, info in ai_status.items():
            if isinstance(info, dict):
                avail = info.get("keys_available", 0)
                total = info.get("total_keys", 0)
                status_icon = "✓" if avail > 0 else "✗"
                print(f"   {status_icon} {provider_name:12s}: {avail}/{total} keys available")
    except Exception as exc:
        print(f"   ✗ Error checking AI router: {exc}")

    print()
    print("=" * 65)
    if NEWS_LANGUAGE == "km" and mirror_available() and TELEGRAM_CHANNEL_ID:
        print("  DIAGNOSTIC SUMMARY: Khmer Bot is READY to drain and mirror.")
    elif NEWS_LANGUAGE == "en" and mirror_available():
        print("  DIAGNOSTIC SUMMARY: English Bot is READY to publish to queue.")
    else:
        print("  DIAGNOSTIC SUMMARY: Issues detected above. Fix environment configuration.")
    print("=" * 65)


if __name__ == "__main__":
    main()
