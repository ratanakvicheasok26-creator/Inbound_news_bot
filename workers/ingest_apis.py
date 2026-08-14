"""API ingestion worker — pulls from all sources, writes to Supabase.

Run: python -m workers.ingest_apis

Env vars required:
    SUPABASE_URL
    SUPABASE_SERVICE_ROLE_KEY
    GROQ_API_KEY (optional — primary AI for summary rewriting)
    GOOGLE_GEMINI_API_KEY (optional — fallback AI when Groq fails)
    NEWSDATA_API_KEY (optional)
    EXA_API_KEY (optional)
    FIRECRAWL_API_KEY (optional)
    CURRENTS_API_KEY (optional)

Sources:
    - GDELT (free, no key)
    - NewsData.io (free tier)
    - Currents API (free, 600 req/day)
    - Lobste.rs (free, no key)
    - Hacker News / Algolia (free, no key)
    - arXiv (free, no key)
    - Semantic Scholar (free, no key)
    - OpenAlex (free, no key)
    - GitHub Trending (free, no key)
    - Hugging Face (free, no key)
    - NVD / NIST CVEs (free, no key)
    - TerminalFeed (free, no key)
    - Wikipedia Pageviews (free, no key) — trend/spike detection
    - GitHub API search (free, no key) — rising repos before they trend
    - The Guardian (free, no key for basic use)
    - Crossref (free, no key) — academic papers
    - dev.to (free, no key)
    - Mastodon public timelines (free, no key)
    - Open Library (free, no key)
    - Stack Exchange (free, no key)
    - WhatsTrending (free, no key) — AI news + model rankings
    - Exa.ai (optional, $10/mo free)
    - Firecrawl (optional, 500 free/mo)
"""

from __future__ import annotations

import json
import logging
import sys
import time
from typing import Any

from dotenv import load_dotenv
load_dotenv()

from workers.ai_rewrite import rewrite_batch
from workers.db import get_supabase
from workers.images import extract_image_url

# --- All source imports ---
from workers.gdelt import fetch_all_gdelt
from workers.newsdata import fetch_all_newsdata
from workers.currents import fetch_all_currents
from workers.lobsters import fetch_all_lobsters
from workers.hackernews import fetch_all_hackernews
from workers.arxiv import fetch_all_arxiv
from workers.semantic_scholar import fetch_all_semantic_scholar
from workers.openalex import fetch_all_openalex
from workers.github_trending import fetch_all_github_trending
from workers.huggingface import fetch_all_huggingface
from workers.nvd import fetch_all_nvd
from workers.terminalfeed import fetch_all_terminalfeed

# --- Free, no-key sources (previously built but never wired in) ---
from workers.wikipedia import fetch_all_wikipedia
from workers.github_api import fetch_all_github_api
from workers.guardian import fetch_all_guardian
from workers.crossref import fetch_all_crossref
from workers.devto import fetch_all_devto
from workers.mastodon import fetch_all_mastodon
from workers.openlibrary import fetch_all_openlibrary
from workers.stackexchange import fetch_all_stackexchange
from workers.whats_trending import fetch_all_whats_trending

# --- Optional sources (graceful skip if no API key) ---
try:
    from workers.exa import fetch_all_exa
except ImportError:
    fetch_all_exa = None  # type: ignore

try:
    from workers.firecrawl import crawl_and_extract
except ImportError:
    crawl_and_extract = None  # type: ignore

logging.basicConfig(
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    level=logging.INFO,
)
logger = logging.getLogger(__name__)


def _upsert_articles(articles: list[dict[str, Any]]) -> int:
    """Insert articles into Supabase, skipping duplicates by URL. Returns count inserted."""
    if not articles:
        return 0

    supabase = get_supabase()
    inserted = 0

    # Batch insert — Supabase handles conflict on UNIQUE(url)
    batch_size = 100
    for i in range(0, len(articles), batch_size):
        batch = articles[i : i + batch_size]
        rows = []
        for a in batch:
            raw = a.get("raw_json")
            image_url = a.get("image_url") or extract_image_url(a)
            rows.append({
                "title": a["title"],
                "summary": a.get("summary", ""),
                "url": a["url"],
                "source_name": a.get("source_name", ""),
                "source_domain": a.get("source_domain", ""),
                "category": a.get("category"),
                "language": a.get("language", "en"),
                "published_at": a.get("published_at"),
                "image_url": image_url,
                "raw_json": json.dumps(raw) if raw else None,
            })

        try:
            result = supabase.table("articles").upsert(
                rows, on_conflict="url", ignore_duplicates=True
            ).execute()
            inserted += len(result.data) if result.data else 0
        except Exception as exc:
            # Retry without image_url if migration 005 is not applied yet
            if "image_url" in str(exc):
                for row in rows:
                    row.pop("image_url", None)
                try:
                    result = supabase.table("articles").upsert(
                        rows, on_conflict="url", ignore_duplicates=True
                    ).execute()
                    inserted += len(result.data) if result.data else 0
                    continue
                except Exception:
                    pass
            logger.exception("Failed to upsert batch %d–%d", i, i + batch_size)

    return inserted


def run() -> None:
    # Fail loud before soft-failing individual sources: missing secrets must
    # turn the Actions step red (get_supabase raises RuntimeError).
    get_supabase()

    logger.info("Starting API ingestion run...")
    all_sources: list[dict[str, Any]] = []

    # --- Core sources (always run) ---

    # 1. GDELT
    try:
        gdelt = fetch_all_gdelt()
        all_sources.extend(gdelt)
        logger.info("GDELT: %d articles", len(gdelt))
    except Exception:
        logger.exception("GDELT failed")

    # 2. NewsData.io
    try:
        newsdata = fetch_all_newsdata()
        all_sources.extend(newsdata)
        logger.info("NewsData.io: %d articles", len(newsdata))
    except Exception:
        logger.exception("NewsData.io failed")

    # 3. Currents API
    try:
        currents = fetch_all_currents()
        all_sources.extend(currents)
        logger.info("Currents API: %d articles", len(currents))
    except Exception:
        logger.exception("Currents API failed")

    # 4. Lobste.rs
    try:
        lobsters = fetch_all_lobsters()
        all_sources.extend(lobsters)
        logger.info("Lobste.rs: %d articles", len(lobsters))
    except Exception:
        logger.exception("Lobste.rs failed")

    # 5. Hacker News
    try:
        hn = fetch_all_hackernews()
        all_sources.extend(hn)
        logger.info("Hacker News: %d articles", len(hn))
    except Exception:
        logger.exception("Hacker News failed")

    # 6. arXiv
    try:
        arxiv = fetch_all_arxiv()
        all_sources.extend(arxiv)
        logger.info("arXiv: %d papers", len(arxiv))
    except Exception:
        logger.exception("arXiv failed")

    # 7. Semantic Scholar
    try:
        ss = fetch_all_semantic_scholar()
        all_sources.extend(ss)
        logger.info("Semantic Scholar: %d papers", len(ss))
    except Exception:
        logger.exception("Semantic Scholar failed")

    # 8. OpenAlex
    try:
        openalex = fetch_all_openalex()
        all_sources.extend(openalex)
        logger.info("OpenAlex: %d works", len(openalex))
    except Exception:
        logger.exception("OpenAlex failed")

    # 9. GitHub Trending
    try:
        github = fetch_all_github_trending()
        all_sources.extend(github)
        logger.info("GitHub Trending: %d repos", len(github))
    except Exception:
        logger.exception("GitHub Trending failed")

    # 10. Hugging Face
    try:
        hf = fetch_all_huggingface()
        all_sources.extend(hf)
        logger.info("Hugging Face: %d items", len(hf))
    except Exception:
        logger.exception("Hugging Face failed")

    # 11. NVD (NIST CVEs) — free, no key. Real cybersecurity content.
    try:
        nvd = fetch_all_nvd()
        all_sources.extend(nvd)
        logger.info("NVD: %d CVEs", len(nvd))
    except Exception:
        logger.exception("NVD failed")

    # 12. TerminalFeed — free, no key. Cybersecurity / cloud / science / crypto.
    try:
        terminal = fetch_all_terminalfeed()
        all_sources.extend(terminal)
        logger.info("TerminalFeed: %d items", len(terminal))
    except Exception:
        logger.exception("TerminalFeed failed")

    # --- Free, no-key sources (previously built but never wired in) ---

    # 13. Wikipedia Pageviews — trending topic / spike detection
    try:
        wiki = fetch_all_wikipedia()
        all_sources.extend(wiki)
        logger.info("Wikipedia: %d items", len(wiki))
    except Exception:
        logger.exception("Wikipedia failed")

    # 14. GitHub API search — catches new/rising repos before they trend
    try:
        gh_api = fetch_all_github_api()
        all_sources.extend(gh_api)
        logger.info("GitHub API: %d repos", len(gh_api))
    except Exception:
        logger.exception("GitHub API failed")

    # 15. The Guardian — quality tech journalism
    try:
        guardian = fetch_all_guardian()
        all_sources.extend(guardian)
        logger.info("Guardian: %d articles", len(guardian))
    except Exception:
        logger.exception("Guardian failed")

    # 16. Crossref — academic papers / research
    try:
        crossref = fetch_all_crossref()
        all_sources.extend(crossref)
        logger.info("Crossref: %d papers", len(crossref))
    except Exception:
        logger.exception("Crossref failed")

    # 17. dev.to — developer articles
    try:
        devto = fetch_all_devto()
        all_sources.extend(devto)
        logger.info("dev.to: %d articles", len(devto))
    except Exception:
        logger.exception("dev.to failed")

    # 18. Mastodon — open-source / tech community timelines
    try:
        mastodon = fetch_all_mastodon()
        all_sources.extend(mastodon)
        logger.info("Mastodon: %d posts", len(mastodon))
    except Exception:
        logger.exception("Mastodon failed")

    # 19. Open Library — tech book trends
    try:
        openlibrary = fetch_all_openlibrary()
        all_sources.extend(openlibrary)
        logger.info("Open Library: %d books", len(openlibrary))
    except Exception:
        logger.exception("Open Library failed")

    # 20. Stack Exchange — trending developer questions
    try:
        stackexchange = fetch_all_stackexchange()
        all_sources.extend(stackexchange)
        logger.info("Stack Exchange: %d questions", len(stackexchange))
    except Exception:
        logger.exception("Stack Exchange failed")

    # 21. WhatsTrending — AI news + model rankings
    try:
        whats_trending = fetch_all_whats_trending()
        all_sources.extend(whats_trending)
        logger.info("WhatsTrending: %d items", len(whats_trending))
    except Exception:
        logger.exception("WhatsTrending failed")

    # --- Optional sources (graceful skip) ---

    # 11. Exa.ai (neural search)
    if fetch_all_exa is not None:
        try:
            exa = fetch_all_exa()
            all_sources.extend(exa)
            logger.info("Exa.ai: %d results", len(exa))
        except Exception:
            logger.exception("Exa.ai failed")

    # 12. Firecrawl (domain crawling)
    if crawl_and_extract is not None:
        try:
            crawl_urls = [
                "https://blog.pragmaticengineer.com/",
                "https://www.paulgraham.com/articles.html",
            ]
            fc = crawl_and_extract(crawl_urls)
            all_sources.extend(fc)
            logger.info("Firecrawl: %d pages", len(fc))
        except Exception:
            logger.exception("Firecrawl failed")

    # --- Dedup by URL ---
    seen: set[str] = set()
    unique_articles: list[dict[str, Any]] = []
    for a in all_sources:
        if a["url"] not in seen:
            seen.add(a["url"])
            unique_articles.append(a)

    logger.info("Total unique articles: %d (from %d sources)", len(unique_articles), len(all_sources))

    # --- AI rewrite summaries (optional, skips if GROQ_API_KEY not set) ---
    try:
        unique_articles = rewrite_batch(unique_articles)
    except Exception:
        logger.exception("AI rewrite failed — continuing with original summaries")

    # --- Upsert to Supabase ---
    if unique_articles:
        inserted = _upsert_articles(unique_articles)
        logger.info("Inserted %d articles into Supabase", inserted)
    else:
        logger.warning("No articles to insert")

    logger.info("API ingestion run complete.")


if __name__ == "__main__":
    try:
        run()
    except Exception:
        logger.exception("API ingestion crashed")
        sys.exit(1)