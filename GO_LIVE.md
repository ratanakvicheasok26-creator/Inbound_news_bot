# Go live checklist (manual)

Code is deploy-ready. Do these steps outside the repo to put **Inbound Reports** online.

**Future (not now):** paid DeepSeek API tier; Supabase plan upgrade. Current AI chain is Groq → OpenRouter → Gemini.

---

## 1. Secrets

Rotate any keys that were ever in a shared `.env`, then set them on hosts — never commit `.env`.

| Where | Vars |
|---|---|
| **Railway/Render (Telegram bot)** | `TELEGRAM_BOT_TOKEN`, `GROQ_API_KEY`, `TELEGRAM_CHANNEL_ID`, `REDIS_URL`, `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` (for `/story` deep links), optional Gemini/OpenRouter / `WEBSITE_BASE_URL` |
| **GitHub Actions secrets (website ingest)** | `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `GROQ_API_KEY`, optional Cohere/NewsData/Gemini/OpenRouter |
| **Vercel (Next.js site)** | `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, optional `GROQ_API_KEY` or `GROQ_API_KEYS` (Local Lens) |
| **Supabase Edge Functions (ABA PayWay)** | `ABA_PAYWAY_MERCHANT_ID`, `ABA_PAYWAY_API_URL`, `ABA_PAYWAY_PUBLIC_KEY`, `ABA_PAYWAY_RSA_PUBLIC_KEY`, `ABA_PAYWAY_RSA_PRIVATE_KEY`, `SITE_URL`, `PAYWAY_CRON_SECRET` — see `docs/PAYWAY.md` |

---

## 2. Supabase

1. Enable **pgvector** (Dashboard → Extensions).
2. Run SQL in order from `supabase/migrations/`:
   - `001_ingestion_schema.sql`
   - `002_profiles_and_auth.sql` (if using auth)
   - `003_match_stories.sql`
   - `004_profiles_insert_policy.sql`
   - `005_image_urls.sql`
   - `006_dedup_hardening.sql`
   - `007_story_sources_article_unique.sql` (one article → one story)
3. Auth: enable email provider; set Site URL + redirect allowlist to your Vercel domain.
4. Confirm tables `articles`, `stories`, `story_sources` exist (anon SELECT policies from 001).

---

## 3. Telegram bot (always-on)

1. Deploy repo as a **worker**: `python news_bot.py` (see `Procfile` / `DEPLOYMENT.md`).
2. Confirm logs: digests at 05:00 / 17:00 `Asia/Phnom_Penh`, health on `PORT` `/health`.
3. Smoke: `/start` then `/fetch` in Telegram.
4. Only one process may poll the same bot token.

---

## 4. Website data (required for a non-empty site)

The Telegram bot **does not** fill the website. Either:

- Enable Actions workflow **Website Ingest** (`.github/workflows/website-ingest.yml`) with secrets above, run once via **workflow_dispatch**, or  
- Manually: `python -m workers.ingest_apis` then `python -m workers.dedup` with service-role env.

Until this runs successfully, the site shows **THE WIRE IS QUIET**.

---

## 5. Next.js site

1. Deploy `inbound-news-web/` to Vercel (or similar).
2. Set public Supabase env vars.
3. Open `/` — after ingest you should see stories; `/search` works with on-page form; `/donate` needs `public/khqr.png`.

---

## 6. Quick verify

| Check | Expect |
|---|---|
| Bot `/health` | `status: ok` (DB may be `skipped` if Supabase unset on bot) |
| Bot `/fetch` | Digest posts to channel |
| Actions ingest | Articles + stories rows in Supabase |
| Site `/` | Lead story, not empty wire |
| Site `/glossary#transformer` | Scrolls to term |
| Auth signup | Profile row created (migrations 002+004) |

---

## Architecture (reminder)

```
Telegram:  sources.yaml → newsbot → AI → Telegram channel/DMs
Website:   workers.ingest_* → articles → workers.dedup → stories → Next.js
```
