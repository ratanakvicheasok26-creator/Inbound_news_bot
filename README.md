# Inbound Reports

**Inbound Reports** digests tech, crypto, and cybersecurity news into Telegram posts and a website story feed. Two pipelines share AI and feed sources but do **not** write to the same store.

## Dual pipeline

| | Telegram bot | Website ingestion |
|---|---|---|
| Entry | `news_bot.py` (Procfile `worker`) | `python -m workers.ingest_apis` then `python -m workers.dedup` |
| Output | Channel + subscriber digests | Supabase `stories` → Next.js site |
| Writes website `stories`? | **No** | **Yes** |

```
(A) ~130 curated RSS → fetch → cluster → AI rewrite → Telegram broadcast
(B) APIs/RSS workers → articles → dedup/embeddings → stories → website
```

- **Feed budget**: ~130 curated URLs (`BOT_MAX_FEEDS`, default 130) from `sources.yaml` via `get_bot_rss_feeds`
- **Schedule**: continuous latest-news trickle (posts as new stories appear, checked hourly by default via `DIGEST_CHECK_INTERVAL_MINUTES`) + multi-story Daily Brief slots at `BRIEF_SCHEDULE_HOURS` (default `6,12,18,22` Asia/Phnom_Penh); urgent/ASAP keyword matches post immediately; `/fetch` for on-demand (5-minute cooldown)
- **AI chain**: Groq → OpenRouter → Gemini (paid DeepSeek planned later — not implemented)
- **Deploy bot**: see [DEPLOYMENT.md](DEPLOYMENT.md) (Railway / Render). Website ingest can also run on a schedule (e.g. GitHub Actions).

Format: facts only — no opinions, speculation, or buy/sell advice.

## Setup (Telegram bot)

```bash
git clone https://github.com/sothunly-alt/Inbound_news_bot.git
cd Inbound_news_bot
python -m venv venv && source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env   # fill tokens
python news_bot.py
```

Minimum env: `TELEGRAM_BOT_TOKEN`, `GROQ_API_KEY`, `TELEGRAM_CHANNEL_ID`. Optional: Redis, AI fallbacks, `BOT_MAX_FEEDS`. Supabase is optional for Telegram; **required** for website workers.

### Website ingestion (local)

```bash
# After running supabase/migrations (001 + 003 match_stories)
export SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=...
python -m workers.ingest_apis
python -m workers.dedup
```

## Commands

| Command | Description |
|---------|-------------|
| `/start` | Subscribe to digests |
| `/stop` | Unsubscribe |
| `/fetch` | Digest now (5-min cooldown) |

## News Categories

| Category | Topics |
|----------|--------|
| Startups | Funding, launches, acquisitions |
| AI & ML | Models, tools, research |
| Cybersecurity | Vulns, breaches, threats |
| DeFi & Crypto | Tokens, protocols, Web3 |
| Big Tech | Apple, Google, Meta, Microsoft, Amazon |
| Hardware & Devices | Chips, phones, robotics |
| Science & Research | Quantum, space, materials |
| Regulation & Policy | Legislation, privacy, courts |

## Output Templates

Urgency selects one of five templates (Breaking / Alert / Analysis / Market / Explainer). Example — **Breaking**:

```
🚨 CRITICAL: <headline>
📂 Cybersecurity

<summary>

📊 KEY METRICS: …
⚠️ WHY IT MATTERS: …
🔍 DETAILS: …
⏰ <timeline>
📌 Source: <name> | <links>
#Tag1 #Tag2
```

## Project Structure

```
news_bot.py          Telegram entry — scheduler, handlers
newsbot/             Bot: config, feeds, AI, state, health
workers/             Website: ingest_apis, dedup, db
shared/              Shared AI router
supabase/migrations/ Schema + match_stories RPC
inbound-news-web/    Next.js site (reads Supabase stories)
tests/
```

## Testing

```bash
python -m pytest tests/ -v
ruff check . --exclude venv
```

## Reliability

- AI retry with backoff; Groq → OpenRouter → Gemini
- Per-feed timeout + global fetch budget
- `/fetch` rate limit; auto-unsubscribe on blocked users
- Redis optional for durable posted-id / subscriber state

## Adding news sources

Prefer `sources.yaml` (registry). `BOT_MAX_FEEDS` caps how many the Telegram bot loads. Website workers use their own ingest paths (APIs + bulk RSS).

## Known limitations

- Without Redis, `posted_ids` / subscribers can reset on redeploy
- Clustering is similarity-based; divergent headlines may not merge
- One Telegram long-poll instance per bot token
- Bot digests do **not** populate the website; run workers (or the website-ingest workflow) separately

## Questions / Bugs

Ping Sothun, Vichea, Raksa, or Hourmeng in the team group.
