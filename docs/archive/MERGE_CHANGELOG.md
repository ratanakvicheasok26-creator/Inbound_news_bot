# State Rework Merge — Change Log

**Date:** July 16, 2026
**Branch:** `my-state-rework` → `main` (PR #2)
**Contributors:** sothunly-alt, ratharo-gitty (Chanratharo)

## Why this merge happened

Two people were fixing overlapping problems from different angles at the same time:
- **Sothun**: continuous polling instead of fixed digest schedule, `STATE_DIR` idea for surviving restarts, diagnosed the dual-instance 409 conflict
- **Chanratharo**: Redis-based state persistence, reliability improvements (retry/rate-limit/timeout), new categories and RSS feeds, template-based message formatting, publication dates

Both branches touched the same core files (`bot.py`, `config.py`, `ai.py`, `feeds.py`), so merging required resolving real conflicts rather than a clean fast-forward.

## Package restructure

Flat modules moved into a `newsbot/` package:
```
ai.py, bot.py, config.py, feeds.py, health.py, state.py
→ newsbot/ai.py, newsbot/bot.py, newsbot/config.py, newsbot/feeds.py, newsbot/health.py, newsbot/state.py
```
Added `pyproject.toml` to support the package layout.

## Scheduling

- Replaced the fixed 5 AM / 5 PM digest schedule with **continuous polling** (`POLL_INTERVAL_SECONDS`, default 1200s / 20 min)
- Each new story now posts individually as soon as it's found, instead of being bundled into a twice-daily digest
- Hourly urgent-keyword check (`URGENT_CHECK_INTERVAL_SECONDS`) runs independently alongside regular polling

## State persistence (`newsbot/state.py`)

- New pluggable `StateBackend` interface with two implementations:
  - `RedisState` — used when `REDIS_URL` is set (Upstash), survives Railway/Render restarts
  - `FileState` — local JSON fallback for development, with atomic writes
- Fixes the repost bug caused by ephemeral disk wipes on restart
- Added title-based dedup (`posted_titles`) alongside ID-based dedup, so near-duplicate headlines from different sources don't double-post

## Broadcast reliability (`newsbot/bot.py`)

- `broadcast_stories()` returns the actual set of successfully-delivered entry IDs instead of silently doing nothing on failure
- Auto-unsubscribes chats that have blocked the bot, instead of retrying them forever
- Falls back from photo → text message if image sending fails (bad request or other error)
- Split into `_prepare_entries()` / `broadcast_stories()` / `_mark_posted()` stages behind a shared `_run_pipeline()`, used by both `fetch_and_post()` (digest) and `fetch_urgent_and_post()` (hourly urgent check)
- Fixed a bug where `TELEGRAM_BOT_TOKEN` resolved to a stale empty string at startup (was imported by value before `validate_config()` populated it — now read as `config.TELEGRAM_BOT_TOKEN` at call time)

## AI rewriting & templates (`newsbot/ai.py`)

- Added a `published_date` field, threaded from RSS entry → AI prompt → AI output → rendered message
- Category and urgency-level classification (`breaking`, `alert`, `analysis`, `market`, `explainer`) with dedicated templates per level
- Header/footer rendering (category label, date, source, tags) consolidated into shared `_render_header()` / `_render_footer()` helpers, used by all five templates — avoids duplicating the same category/date logic five times
- Retry logic on Groq API calls (`_MAX_RETRIES = 3`, exponential backoff)
- JSON output validation with graceful fallback to a minimal valid post if the AI output is malformed or fails validation

## Feeds (`newsbot/feeds.py`)

- Expanded RSS feed list — added Medium feeds for AI, cybersecurity, crypto, startups, tech, plus category-specific sources (hardware, science, regulation)
- New `NEWS_CATEGORIES` set: `startups`, `ai`, `cybersecurity`, `defi`, `big_tech`, `hardware`, `science`, `regulation`
- Parallel feed fetching via thread pool, thread-local HTTP clients
- Entry age filtering (`MAX_ENTRY_AGE_HOURS`) to skip stale items
- `published_date` extraction from RSS `published_parsed`/`updated_parsed` fields

## Deployment

- Added `Procfile` and `runtime.txt`
- `.github/workflows/` updated — **note:** the old cron-based digest workflow (fixed 5 AM/5 PM UTC schedule) may still reference the old schedule; worth double-checking it doesn't conflict with continuous polling going forward

## New/required environment variables

```
POLL_INTERVAL_SECONDS   # seconds between polls, default 1200
REDIS_URL               # optional, enables persistent state (Upstash)
```

## Testing

- Existing test suite expanded: `tests/test_ai.py`, `tests/test_bot.py`, `tests/test_feeds.py`, `tests/test_state.py` (new), `tests/test_news_bot.py` (new)
- Verified locally: bot boots, health server starts, config loads, Telegram token resolves correctly
- Did not verify live polling end-to-end locally, since Railway/Render already held the Telegram polling lock during testing (expected — only one instance can poll per token)

## Follow-up items

- [ ] Update README to reflect: new file structure, continuous polling schedule, new env vars, current deploy target
- [ ] Check `.github/workflows/` cron job for conflicts with continuous polling
- [ ] Confirm which platform (Render or Railway) is the source of truth for production deploys
