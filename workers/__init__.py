"""Inbound Reports — website ingestion workers.

Run from the repo root:
    python -m workers.ingest_apis     # pull from GDELT + NewsData.io (+ optional APIs)
    python -m workers.rss_bulk        # pull from feeds_bulk.txt
    python -m workers.dedup           # cluster articles into stories

These workers write to Supabase for the Next.js site. They are separate from the
Telegram bot (`news_bot.py`), which does not populate website stories.

Environment variables required:
    SUPABASE_URL           — your Supabase project URL
    SUPABASE_SERVICE_ROLE_KEY — service-role key (NOT anon key)
    NEWSDATA_API_KEY       — from newsdata.io (optional, free tier)
    COHERE_API_KEY         — from cohere.com (for dedup embeddings)
"""
