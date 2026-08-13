# Deploying Inbound Reports (Railway / Render)

Inbound Reports has **two pipelines**. This doc is mainly for the **Telegram bot** worker (24/7 schedule). Website stories are filled by a **separate** ingestion path — the bot does **not** write to Supabase `stories`.

| Pipeline | How it runs | Writes |
|---|---|---|
| **Telegram bot** | Railway/Render `worker: python news_bot.py` | Channel + DMs only |
| **Website ingestion** | Cron / Actions / manual `workers.ingest_apis` + `workers.dedup` | Supabase → Next.js |

Pick **Railway** or **Render** for the bot — you don't need both. Railway is usually faster to set up; Render's free tier has more restrictions.

---

## Before you start (Telegram bot)

The bot long-polls Telegram and starts a small HTTP health server on `PORT` (default `10000`) at `/` and `/health`. Prefer a **worker** service; if the platform requires a web process, point health checks at `/health`.

**`Procfile`**
```
worker: python news_bot.py
```

**`runtime.txt`**
```
python-3.12
```

Keep `requirements.txt` in sync with the repo.

### Production checklist (bot)

| Variable | Required? | Why |
|---|---|---|
| `TELEGRAM_BOT_TOKEN` | **Yes** | Bot API |
| `GROQ_API_KEY` | **Yes** | Primary AI |
| `TELEGRAM_CHANNEL_ID` | Strongly recommended | Channel digests |
| `REDIS_URL` | Strongly recommended | Durable state across redeploys |
| `GOOGLE_GEMINI_API_KEY` / `OPENROUTER_API_KEY` | Recommended | AI fallback chain (Groq → OpenRouter → Gemini) |
| `SUPABASE_*` | Optional for Telegram | Needed for website workers / health DB probe only |
| `BOT_MAX_FEEDS` | Optional (default 130) | Caps RSS fetches for digest timeout |

Website (Vercel/etc.) needs `NEXT_PUBLIC_SUPABASE_URL` + `NEXT_PUBLIC_SUPABASE_ANON_KEY`. Apply SQL migrations under `supabase/migrations/` (including `003_match_stories.sql`) so `stories` / `articles` / `story_sources` and the `match_stories` RPC exist.

**Future (not now):** paid DeepSeek AI tier and a Supabase plan upgrade — not wired in this repo yet.

---

## Website ingestion

The Telegram worker never populates the site. Run migrations, set worker env, then schedule:

```bash
python -m workers.ingest_apis
python -m workers.dedup
```

Or use `.github/workflows/website-ingest.yml` (every 6 hours + `workflow_dispatch`).

### Migrations

1. Enable **pgvector** in Supabase (Dashboard → Extensions).
2. Run `001_ingestion_schema.sql`, `002_profiles_and_auth.sql` (if using auth), `003_match_stories.sql`, then `004_profiles_insert_policy.sql`.

### Worker environment

| Variable | Required? | Why |
|---|---|---|
| `SUPABASE_URL` | **Yes** | Project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | **Yes** | Service-role writes (not anon) |
| `GROQ_API_KEY` | Recommended | AI rewrite / shared router if used |
| `COHERE_API_KEY` | Optional | Embeddings for dedup; Jaccard fallback if missing |
| `NEWSDATA_API_KEY` | Optional | NewsData.io ingest |
| `GOOGLE_GEMINI_API_KEY` / `OPENROUTER_API_KEY` | Optional | AI fallbacks |
| `EXA_API_KEY` / `FIRECRAWL_API_KEY` / `CURRENTS_API_KEY` | Optional | Extra API sources |

---

## Rotate all secrets

Rotate keys in each provider console, then update Railway/Render **Environment Variables**. Never commit `.env`.

| Secret | Where to rotate | Env var(s) |
|---|---|---|
| Telegram bot token | [@BotFather](https://t.me/BotFather) | `TELEGRAM_BOT_TOKEN` |
| Groq | [console.groq.com](https://console.groq.com) | `GROQ_API_KEY` |
| Gemini | [aistudio.google.com/apikey](https://aistudio.google.com/apikey) | `GOOGLE_GEMINI_API_KEY` |
| OpenRouter | [openrouter.ai/keys](https://openrouter.ai/keys) | `OPENROUTER_API_KEY` |
| Supabase service role | Project → Settings → API | `SUPABASE_SERVICE_ROLE_KEY` (+ `SUPABASE_URL`) |
| Redis | Upstash (or host) | `REDIS_URL` |
| Cohere / NewsData / etc. | Provider consoles | `COHERE_API_KEY`, `NEWSDATA_API_KEY`, … |

Redeploy/restart after rotating.

---

## Environment variables (match `.env.example`)

**Telegram**
- `TELEGRAM_BOT_TOKEN` (required)
- `TELEGRAM_CHANNEL_ID`, `TELEGRAM_THREAD_ID`, `TELEGRAM_GROUP_CHAT_ID`

**Redis** (optional)
- `REDIS_URL`

**Supabase** (optional for bot; **required** for website workers — not “bot → website”)
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

**AI** (comma-separated keys for rotation)
- `GROQ_API_KEY` (required for bot)
- `GOOGLE_GEMINI_API_KEY`, `OPENROUTER_API_KEY`, `OPENROUTER_MODEL`

**Scheduling / tuning** (optional — defaults in `newsbot/config.py`)
- `POLL_INTERVAL_SECONDS` (default 1800 = posts new news every 30 min), `URGENT_CHECK_INTERVAL_SECONDS`
- `BOT_MAX_FEEDS`, `MAX_ITEMS_PER_FEED`, `MAX_ENTRY_AGE_HOURS`, `FEED_TIMEOUT_SECONDS`
- `CLUSTER_SIMILARITY_THRESHOLD`, `PREPARE_ENTRIES_TIMEOUT_SECONDS`, `AI_HTTP_TIMEOUT_SECONDS`
- `SPAM_FILTER_ENABLED`, `DONATION_TEXT`, `DIGEST_HEADER_TEXT`, …
- Do **not** set `BRIEF_TEXT` / `BRIEF_TEXT_KM` (removed empty-slot CTA). Leftovers are ignored.

---

## Option A: Railway

1. [railway.app](https://railway.app) → **New Project → Deploy from GitHub** → `sothunly-alt/Inbound_news_bot`
2. Prefer Procfile worker; else set start command to `python news_bot.py`
3. Add Variables (at least `TELEGRAM_BOT_TOKEN`, `GROQ_API_KEY`)
4. Deploy; logs should mention the continuous news poll
5. Test `/fetch` on Telegram

## Option B: Render

1. [render.com](https://render.com) → **Background Worker** (or Web Service if you need `/health` on `PORT`)
2. Build: `pip install -r requirements.txt` · Start: `python news_bot.py`
3. Set the same secrets; prefer `REDIS_URL` + `TELEGRAM_CHANNEL_ID` in production
4. Confirm logs, then test `/fetch`

**Free tier note:** Render free workers may spin down or hit runtime limits — check current docs.

---

## After deploying

- With `REDIS_URL`, subscribers and posted IDs persist. Without Redis, fresh deploys may reset local JSON state.
- **One** long-poll instance per bot token (local + cloud together → `Conflict` on `getUpdates`).
- Never commit `.env`. Website content still needs the ingestion workers (or Actions cron), not just the bot.

## Quick comparison

| | Railway | Render |
|---|---|---|
| Setup | Often auto-detects Procfile | Pick Background Worker explicitly |
| Free tier | Small monthly credit | May not suit always-on workers |
| Best for | Fast first deploy | Fine if worker support checks out |
