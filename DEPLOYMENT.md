# Deploying the Inbound News Bot (Railway / Render)

This bot needs to run 24/7 to catch the 5 AM / 5 PM scheduled posts — it can't rely on anyone's laptop staying open. This doc covers deploying it to either **Railway** or **Render**, both of which have free/cheap tiers that work for this.

Pick one — you don't need both. Railway is generally the faster setup; Render's free tier has more restrictions (see notes below).

---

## Before you start (either platform)

This bot is a **background worker**, not a web server — it doesn't listen on an HTTP port, it just polls Telegram continuously. Both platforms default to expecting a web service, so we need to explicitly tell them this is a worker/background process. Details below per platform.

Make sure these two files exist in the repo root (create them if missing):

**`requirements.txt`** — keep in sync with the repo (includes `openai==1.82.0`, `google-genai`, Redis, Supabase, etc.)

**`Procfile`** (no file extension, just `Procfile`)
```
worker: python news_bot.py
```

**`runtime.txt`**
```
python-3.12
```

Commit and push both to the repo before deploying.

---

## Rotate all secrets (do this before / after any leak)

You cannot rotate provider keys from this repo — do it in each provider's console, then update Railway/Render **Environment Variables**. Never commit `.env`.

Checklist — revoke the old value, create a new one, then set it in the host:

| Secret | Where to rotate | Env var(s) |
|---|---|---|
| Telegram bot token | [@BotFather](https://t.me/BotFather) → `/revoke` or new bot | `TELEGRAM_BOT_TOKEN` |
| Groq API key(s) | [console.groq.com](https://console.groq.com) | `GROQ_API_KEY` (comma-separated OK) |
| Gemini API key(s) | [aistudio.google.com/apikey](https://aistudio.google.com/apikey) | `GOOGLE_GEMINI_API_KEY` |
| OpenRouter API key(s) | [openrouter.ai/keys](https://openrouter.ai/keys) | `OPENROUTER_API_KEY` |
| Supabase service role | Supabase project → Settings → API | `SUPABASE_SERVICE_ROLE_KEY` (+ `SUPABASE_URL`) |
| Redis password / URL | Upstash (or your Redis host) | `REDIS_URL` |

Also re-check channel/group IDs if you recreate chats: `TELEGRAM_CHANNEL_ID`, `TELEGRAM_THREAD_ID`, `TELEGRAM_GROUP_CHAT_ID`.

After rotating: redeploy (or restart) so the worker picks up the new variables. Delete any stale local `.env` copies that still hold old secrets.

---

## Environment variables (match `.env.example`)

Set these in Railway/Render **Variables** (not in git):

**Telegram**
- `TELEGRAM_BOT_TOKEN` (required)
- `TELEGRAM_CHANNEL_ID`
- `TELEGRAM_THREAD_ID`
- `TELEGRAM_GROUP_CHAT_ID`

**Redis** (optional — persistent state across restarts)
- `REDIS_URL` — e.g. `redis://default:PASSWORD@HOST:6379`

**Supabase** (bot → website)
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

**AI providers** (comma-separated keys for rotation)
- `GROQ_API_KEY` (required)
- `GOOGLE_GEMINI_API_KEY`
- `OPENROUTER_API_KEY`
- `OPENROUTER_MODEL` (optional override)

**Scheduling / tuning** (optional — defaults in `newsbot/config.py`)
- `POLL_INTERVAL_SECONDS`
- `DIGEST_SCHEDULE_HOUR_AM` / `DIGEST_SCHEDULE_HOUR_PM`
- `MAX_ITEMS_PER_FEED`, `MAX_ENTRY_AGE_HOURS`, `FEED_TIMEOUT_SECONDS`
- `CLUSTER_SIMILARITY_THRESHOLD`
- `PREPARE_ENTRIES_TIMEOUT_SECONDS`, `AI_HTTP_TIMEOUT_SECONDS`
- `SPAM_FILTER_ENABLED`, `SPAM_BLOCK_NON_LATIN_SCRIPTS`
- `DONATION_TEXT`, `DONATION_QR_IMAGE`, `DIGEST_HEADER_TEXT`

---

## Option A: Railway

1. Go to [railway.app](https://railway.app) and sign in with GitHub
2. Click **New Project → Deploy from GitHub repo**
3. Select `sothunly-alt/Inbound_news_bot`
4. Railway will detect the `Procfile` and set up a worker service automatically. If it instead tries to spin up a web service, go to the service's **Settings → Deploy** and manually set the **Start Command** to:
   ```
   python news_bot.py
   ```
5. Go to the service's **Variables** tab and add the secrets from the list above (at minimum `TELEGRAM_BOT_TOKEN` and `GROQ_API_KEY`).
6. Deploy. Check the **Logs** tab — you should see a "Bot running..." line mentioning the 5 AM / 5 PM digest schedule.
7. Test it — send `/fetch` to the bot on Telegram and confirm the logs show activity and a message lands in the subscribed chat.

**Cost note:** Railway's free tier gives a small monthly credit (check current limits on their pricing page — this changes over time). A lightweight polling bot like this uses very little compute, so it should comfortably fit unless the trial credit runs out — worth checking the billing tab after the first week.

---

## Option B: Render

1. Go to [render.com](https://render.com) and sign in with GitHub
2. Click **New → Background Worker** (important — NOT "Web Service", since this bot has no HTTP endpoint)
3. Connect the `sothunly-alt/Inbound_news_bot` repo
4. Configure:
   - **Environment**: Python 3
   - **Build Command**: `pip install -r requirements.txt`
   - **Start Command**: `python news_bot.py`
5. Under **Environment Variables**, add the secrets from the list above (at minimum `TELEGRAM_BOT_TOKEN` and `GROQ_API_KEY`).
6. Click **Create Background Worker** and wait for the build/deploy to finish
7. Check the **Logs** tab for the "Bot running..." message, then test with `/fetch`

**Free tier note:** Render's free tier for background workers may have monthly runtime limits or spin-down behavior — check Render's current free tier docs before relying on it long-term, since these limits change. If the free tier doesn't support always-on background workers, their cheapest paid tier (a few dollars/month) is the reliable option for a bot that needs to fire on a schedule.

---

## After deploying (either platform)

- **`subscribers.json` and `posted_ids.json`** are created locally at runtime and are gitignored — meaning on a fresh deploy, they start empty. With `REDIS_URL` set, subscribers and posted IDs persist across restarts. Without Redis, everyone may need to send `/start` again after a fresh deploy.
- **Only one instance of the bot can poll Telegram at a time** with the same token. Once it's deployed and running on Railway/Render, make sure nobody is also running `python news_bot.py` locally with the same `TELEGRAM_BOT_TOKEN` — you'll get a `Conflict: terminated by other getUpdates request` error if two instances run simultaneously.
- If you rotate any secret, update Environment Variables on Railway/Render — never commit `.env`.

## Quick platform comparison

| | Railway | Render |
|---|---|---|
| Setup speed | Faster, auto-detects Procfile | Slightly more manual (must pick "Background Worker" explicitly) |
| Free tier | Small monthly usage credit | Free tier may not support always-on workers — check current docs |
| Best for | Getting this running today | Fine too, just double-check worker support on free tier first |

If unsure, try Railway first — it's the more forgiving setup for a first deploy.
