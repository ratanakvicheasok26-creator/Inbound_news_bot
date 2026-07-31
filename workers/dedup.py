"""Dedup worker — clusters articles into stories using Cohere embeddings + pgvector.

Run: python -m workers.dedup

Env vars required:
    SUPABASE_URL
    SUPABASE_SERVICE_ROLE_KEY
    COHERE_API_KEY (optional — falls back to Jaccard similarity if missing/down)

This worker:
1. Fetches unprocessed articles from Supabase
2. Generates Cohere embeddings for each article title + summary
3. Searches pgvector for existing stories with cosine similarity >= 0.85
4. If similar story found: adds article to that story
5. If no similar story: creates a new story
"""

from __future__ import annotations

import logging
import os
import time
from typing import Any

from dotenv import load_dotenv
load_dotenv()

from workers.db import get_supabase

logging.basicConfig(
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    level=logging.INFO,
)
logger = logging.getLogger(__name__)

_SIMILARITY_THRESHOLD = 0.85
_EMBED_MODEL = "embed-multilingual-v3.0"
_EMBED_DIM = 1024
_BATCH_SIZE = 100
_MAX_RETRIES = 3
_RETRY_BASE_DELAY = 2.0


def _get_cohere_client():
    """Get Cohere client. Returns None if COHERE_API_KEY is not set or import fails."""
    api_key = os.environ.get("COHERE_API_KEY", "").strip()
    if not api_key:
        logger.warning("COHERE_API_KEY not set — will use Jaccard fallback")
        return None
    try:
        import cohere
        return cohere.ClientV2(api_key)
    except ImportError:
        logger.warning("cohere package not installed — will use Jaccard fallback")
        return None
    except Exception as exc:
        logger.warning("Failed to create Cohere client: %s", exc)
        return None


def _embed_texts_with_retry(client, texts: list[str]) -> list[list[float]] | None:
    """Generate embeddings with retry. Returns None on failure."""
    if not texts:
        return []

    for attempt in range(1, _MAX_RETRIES + 1):
        try:
            result = client.embed(
                texts=texts,
                model=_EMBED_MODEL,
                input_type="search_document",
                embedding_types=["float"],
            )
            return [e for e in result.embeddings.float]
        except Exception as exc:
            if attempt < _MAX_RETRIES:
                delay = _RETRY_BASE_DELAY * (2 ** (attempt - 1))
                logger.warning(
                    "Cohere embed attempt %d/%d failed (%s), retrying in %.1fs",
                    attempt, _MAX_RETRIES, exc, delay,
                )
                time.sleep(delay)
            else:
                logger.error("Cohere embed failed after %d attempts: %s", _MAX_RETRIES, exc)
    return None


def _jaccard_similarity(a: str, b: str) -> float:
    """Simple word-level Jaccard similarity for fallback clustering."""
    words_a = set(a.lower().split())
    words_b = set(b.lower().split())
    if not words_a or not words_b:
        return 0.0
    intersection = words_a & words_b
    union = words_a | words_b
    return len(intersection) / len(union)


def _fetch_unprocessed(supabase, limit: int = 500) -> list[dict[str, Any]]:
    """Fetch articles that haven't been linked to a story yet.

    Two-step query: load recent story_sources article_ids, then filter articles
    in Python. Nested ``not_.in_(subquery)`` is fragile with PostgREST.
    """
    linked_result = (
        supabase.table("story_sources")
        .select("article_id")
        .limit(max(limit * 20, 5000))
        .execute()
    )
    linked_ids = {
        row["article_id"]
        for row in (linked_result.data or [])
        if row.get("article_id")
    }

    # Over-fetch recent articles, then drop ones already linked.
    fetch_n = limit * 3 if linked_ids else limit
    articles_result = (
        supabase.table("articles")
        .select("*")
        .order("ingested_at", desc=True)
        .limit(fetch_n)
        .execute()
    )
    articles = articles_result.data or []
    unprocessed = [a for a in articles if a.get("id") not in linked_ids]
    return unprocessed[:limit]


def _search_similar_stories(supabase, embedding: list[float], threshold: float = 0.85) -> str | None:
    """Search for existing stories with similar embeddings. Returns story_id or None.

    On RPC failure, logs a warning and returns None so the caller can use Jaccard.
    """
    import json
    embedding_str = json.dumps(embedding)

    try:
        result = supabase.rpc("match_stories", {
            "query_embedding": embedding_str,
            "match_threshold": threshold,
            "match_count": 1,
        }).execute()
    except Exception as exc:
        logger.warning(
            "match_stories RPC failed (%s) — Jaccard fallback will run",
            exc,
        )
        return None

    matches = result.data or []
    if matches:
        return matches[0]["id"]
    return None


def _search_similar_stories_jaccard(supabase, title: str, threshold: float = 0.6) -> str | None:
    """Fallback: search for similar stories using title word overlap."""
    result = supabase.table("stories").select("id, title").order(
        "created_at", desc=True
    ).limit(200).execute()

    stories = result.data or []
    best_score = 0.0
    best_id = None

    for story in stories:
        score = _jaccard_similarity(title, story.get("title", ""))
        if score > best_score:
            best_score = score
            best_id = story["id"]

    if best_score >= threshold:
        return best_id
    return None


def _create_story(supabase, article: dict, embedding: list[float] | None = None) -> str:
    """Create a new story from an article. Returns the story ID."""
    row = {
        "title": article["title"],
        "summary_en": article.get("summary", ""),
        "source_count": 1,
        "category": article.get("category"),
        "tags": [],
    }
    if embedding is not None:
        row["embedding"] = embedding

    result = supabase.table("stories").insert(row).execute()
    story_id = result.data[0]["id"]

    supabase.table("story_sources").insert({
        "story_id": story_id,
        "article_id": article["id"],
        "source_name": article.get("source_name", ""),
        "source_url": article.get("url", ""),
    }).execute()

    return story_id


def _add_to_story(supabase, story_id: str, article: dict) -> None:
    """Add an article to an existing story and increment source_count."""
    supabase.table("story_sources").insert({
        "story_id": story_id,
        "article_id": article["id"],
        "source_name": article.get("source_name", ""),
        "source_url": article.get("url", ""),
    }).execute()

    # Increment source_count directly
    current = supabase.table("stories").select("source_count").eq("id", story_id).execute()
    if current.data:
        new_count = (current.data[0].get("source_count") or 0) + 1
        supabase.table("stories").update({"source_count": new_count}).eq("id", story_id).execute()


def run() -> None:
    try:
        _run_inner()
    except Exception:
        logger.exception("Dedup worker crashed — this should never happen. All articles preserved.")
        return


def _run_inner() -> None:
    supabase = get_supabase()
    cohere_client = _get_cohere_client()
    use_embeddings = cohere_client is not None

    logger.info("Fetching unprocessed articles...")
    articles = _fetch_unprocessed(supabase, limit=500)
    logger.info("Found %d unprocessed articles", len(articles))

    if not articles:
        logger.info("Nothing to dedup.")
        return

    # Generate embeddings if Cohere is available
    embeddings: list[list[float]] | None = None
    if use_embeddings:
        texts = [
            f"{a.get('title', '')}. {a.get('summary', '')[:200]}"
            for a in articles
        ]
        logger.info("Generating embeddings for %d articles via Cohere...", len(texts))
        embeddings = _embed_texts_with_retry(cohere_client, texts)
        if embeddings is None:
            logger.warning("Cohere embedding failed — falling back to Jaccard similarity")
            use_embeddings = False

    if not use_embeddings:
        logger.info("Using Jaccard title similarity (Cohere unavailable)")

    # Process each article
    new_stories = 0
    merged = 0
    errors = 0

    for i, article in enumerate(articles):
        try:
            embedding = embeddings[i] if embeddings and i < len(embeddings) else None

            if use_embeddings and embedding is not None:
                story_id = _search_similar_stories(supabase, embedding, _SIMILARITY_THRESHOLD)
                if story_id is None:
                    story_id = _search_similar_stories_jaccard(
                        supabase, article.get("title", ""), threshold=0.6
                    )
            else:
                story_id = _search_similar_stories_jaccard(
                    supabase, article.get("title", ""), threshold=0.6
                )

            if story_id:
                _add_to_story(supabase, story_id, article)
                merged += 1
            else:
                _create_story(supabase, article, embedding)
                new_stories += 1

        except Exception as exc:
            errors += 1
            logger.warning(
                "Failed to process article '%.60s' (id=%s): %s",
                article.get("title", ""),
                article.get("id"),
                exc,
            )
            continue

    logger.info("Dedup complete: %d new stories, %d merged, %d errors",
                new_stories, merged, errors)

    # Log vector index hint
    story_count = supabase.table("stories").select("id", count="exact").execute()
    total = story_count.count or 0
    if total >= 100:
        logger.info("Story count: %d — consider creating vector index:", total)
        logger.info("  CREATE INDEX stories_embedding_idx ON stories "
                    "USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);")


if __name__ == "__main__":
    run()