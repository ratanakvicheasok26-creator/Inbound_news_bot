# Crash Report: Invalid Telegram Bot Token

**Service:** worker (truthful-enthusiasm)
**Date:** Jul 16, 2026, 9:55 AM GMT+7
**Status:** Crashed (repeating)

---

## Error

```
telegram.error.InvalidToken: You must pass the token you received from https://t.me/Botfather!
```

## Root Cause

The `TELEGRAM_BOT_TOKEN` environment variable in Railway is **empty or invalid**.

The bot reads it from the environment at `config.py:67`:

```python
TELEGRAM_BOT_TOKEN: str = os.environ["TELEGRAM_BOT_TOKEN"]
```

Then passes it to the Telegram library at `news_bot.py:129`:

```python
app = Application.builder().token(TELEGRAM_BOT_TOKEN).build()
```

The library rejects the empty/invalid token and raises `InvalidToken`, crashing the process.

## Why It Crashes in a Loop

Railway detects the process exit and restarts it. Each restart hits the same error, creating the repeating crash loop seen in the logs.

## Fix

1. Go to **Railway Dashboard** → your **worker** service → **Variables** tab.
2. Find or add the variable `TELEGRAM_BOT_TOKEN`.
3. Set its value to the token from [@BotFather](https://t.me/BotFather) on Telegram.
   - Format: `123456789:ABCdefGHIjklMNOpqrSTUvwxYZ` (no quotes, no spaces).
4. Save and redeploy.

## Optional Variables to Verify

| Variable | Required | Description |
|---|---|---|
| `TELEGRAM_BOT_TOKEN` | Yes | Bot token from @BotFather |
| `GROQ_API_KEY` | Yes | API key from console.groq.com/keys |
| `TELEGRAM_CHANNEL_ID` | No | Channel ID to post news to |
| `TELEGRAM_THREAD_ID` | No | Thread/topic ID within the channel |
| `REDIS_URL` | No | Enables persistent state on Railway |

---

**File:** `CRASH_REPORT.md`
