#!/usr/bin/env bash
# run_both.sh — Start the English bot and the Khmer mirror bot as two processes.
#
# Usage:
#   ./run_both.sh
#
# Both bots share the same REDIS_URL so the Khmer bot can drain the English
# bot's mirror queue.  Each bot reads its own .env.en / .env.km file.
#
# To stop both bots:
#   kill $(cat /tmp/en_bot.pid) $(cat /tmp/km_bot.pid)
# Or just Ctrl-C if running in the foreground.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

# ── Validate English env ──────────────────────────────────────────────────────
EN_ENV=".env.en"
KM_ENV=".env.km"

if [[ ! -f "$EN_ENV" ]]; then
    echo "ERROR: $EN_ENV not found. Create it from .env.example and set NEWS_LANGUAGE=en."
    exit 1
fi
if [[ ! -f "$KM_ENV" ]]; then
    echo "ERROR: $KM_ENV not found."
    exit 1
fi

# Warn if the English bot token placeholder is still there
if grep -q "YOUR_ENGLISH_BOT_TOKEN_HERE" "$EN_ENV"; then
    echo "ERROR: Please edit .env.en and fill in your English bot's TELEGRAM_BOT_TOKEN."
    echo "       Get it from @BotFather on Telegram."
    exit 1
fi
if grep -q "YOUR_ENGLISH_CHANNEL_ID_HERE" "$EN_ENV"; then
    echo "ERROR: Please edit .env.en and fill in your English bot's TELEGRAM_CHANNEL_ID."
    exit 1
fi

# ── Activate venv if present ──────────────────────────────────────────────────
if [[ -f "venv/bin/activate" ]]; then
    source venv/bin/activate
fi

echo "=== Starting English bot (NEWS_LANGUAGE=en) ==="
env $(grep -v '^#' "$EN_ENV" | xargs) python news_bot.py &
EN_PID=$!
echo "$EN_PID" > /tmp/en_bot.pid
echo "  PID: $EN_PID"

# Small delay so the English bot acquires its instance lock first
sleep 2

echo "=== Starting Khmer mirror bot (NEWS_LANGUAGE=km) ==="
env $(grep -v '^#' "$KM_ENV" | xargs) python news_bot.py &
KM_PID=$!
echo "$KM_PID" > /tmp/km_bot.pid
echo "  PID: $KM_PID"

echo ""
echo "Both bots are running."
echo "  English bot PID: $EN_PID  (logs will be interleaved)"
echo "  Khmer bot   PID: $KM_PID"
echo ""
echo "Press Ctrl-C to stop both bots."

# Wait for both — Ctrl-C kills the script and both subprocesses
trap "echo 'Stopping both bots...'; kill $EN_PID $KM_PID 2>/dev/null; exit 0" INT TERM
wait $EN_PID $KM_PID
