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
import sys
import time
from typing import Any

from dotenv import load_dotenv

load_dotenv()

from workers.categories import is_site_slug, normalize_category
from workers.db import get_supabase
from workers.images import extract_image_url, fetch_og_image

logging.basicConfig(
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    level=logging.INFO,
)
logger = logging.getLogger(__name__)

_SIMILARITY_THRESHOLD = 0.85
_EMBED_MODEL = "embed-multilingual-v3.0"
_EMBED_DIM = 1024
_BATCH_SIZE = 100
# Cohere caps each embed request at 96 texts for this model.
_EMBED_CHUNK_SIZE = 96
_MAX_RETRIES = 3
_RETRY_BASE_DELAY = 2.0
_FETCH_PAGE_SIZE = 1000


def _is_unique_violation(exc: BaseException) -> bool:
    """True when PostgREST/Postgres rejected a UNIQUE constraint."""
    msg = str(exc).lower()
    return (
        "duplicate" in msg
        or "unique" in msg
        or "23505" in msg
        or "already exists" in msg
    )


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
    """Generate embeddings with retry. Returns None on failure.

    Cohere caps each request at 96 texts, so we chunk before calling.
    """
    if not texts:
        return []

    embeddings: list[list[float]] = []
    for start in range(0, len(texts), _EMBED_CHUNK_SIZE):
        chunk = texts[start : start + _EMBED_CHUNK_SIZE]
        chunk_result = None
        for attempt in range(1, _MAX_RETRIES + 1):
            try:
                result = client.embed(
                    texts=chunk,
                    model=_EMBED_MODEL,
                    input_type="search_document",
                    embedding_types=["float"],
                )
                chunk_result = [e for e in result.embeddings.float]
                break
            except Exception as exc:
                if attempt < _MAX_RETRIES:
                    delay = _RETRY_BASE_DELAY * (2 ** (attempt - 1))
                    logger.warning(
                        "Cohere embed attempt %d/%d for chunk %d failed (%s), retrying in %.1fs",
                        attempt, _MAX_RETRIES, start // _EMBED_CHUNK_SIZE, exc, delay,
                    )
                    time.sleep(delay)
                else:
                    logger.error("Cohere embed failed after %d attempts: %s", _MAX_RETRIES, exc)
        if chunk_result is None:
            return None
        embeddings.extend(chunk_result)
    return embeddings


def _jaccard_similarity(a: str, b: str) -> float:
    """Simple word-level Jaccard similarity for fallback clustering."""
    words_a = set(a.lower().split())
    words_b = set(b.lower().split())
    if not words_a or not words_b:
        return 0.0
    intersection = words_a & words_b
    union = words_a | words_b
    return len(intersection) / len(union)


def _fetch_unprocessed(supabase, limit: int = 1000) -> list[dict[str, Any]]:
    """Fetch articles that haven't been linked to a story yet.

    Paginates *all* story_sources article_ids so the linked set is complete,
    then paginates articles newest-first until ``limit`` unprocessed rows
    are collected (or the table is exhausted). Filtering against an
    incomplete linked set is what caused duplicate stories at scale.
    """
    linked_ids: set[str] = set()
    offset = 0
    while True:
        page = (
            supabase.table("story_sources")
            .select("article_id")
            .order("id")
            .range(offset, offset + _FETCH_PAGE_SIZE - 1)
            .execute()
        )
        rows = page.data or []
        if not rows:
            break
        linked_ids.update(row["article_id"] for row in rows if row.get("article_id"))
        if len(rows) < _FETCH_PAGE_SIZE:
            break
        offset += _FETCH_PAGE_SIZE

    logger.info("Loaded %d already-linked article ids", len(linked_ids))

    unprocessed: list[dict[str, Any]] = []
    offset = 0
    while len(unprocessed) < limit:
        page = (
            supabase.table("articles")
            .select("*")
            .order("ingested_at", desc=True)
            .range(offset, offset + _FETCH_PAGE_SIZE - 1)
            .execute()
        )
        rows = page.data or []
        if not rows:
            break
        for article in rows:
            if article.get("id") not in linked_ids:
                unprocessed.append(article)
                if len(unprocessed) >= limit:
                    break
        if len(rows) < _FETCH_PAGE_SIZE:
            break
        offset += _FETCH_PAGE_SIZE

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


def _load_story_titles(supabase, cap: int = 5000) -> list[dict[str, str]]:
    """Load (id, title) for all stories, newest first, paginated (bounded)."""
    titles: list[dict[str, str]] = []
    offset = 0
    while offset < cap:
        result = (
            supabase.table("stories")
            .select("id, title")
            .order("created_at", desc=True)
            .range(offset, offset + _FETCH_PAGE_SIZE - 1)
            .execute()
        )
        rows = result.data or []
        if not rows:
            break
        titles.extend(rows)
        if len(rows) < _FETCH_PAGE_SIZE:
            break
        offset += _FETCH_PAGE_SIZE
    return titles[:cap]


def _search_similar_stories_jaccard(
    story_titles: list[dict[str, str]], title: str, threshold: float = 0.6
) -> str | None:
    """Fallback: search for similar stories using title word overlap."""
    best_score = 0.0
    best_id = None

    for story in story_titles:
        score = _jaccard_similarity(title, story.get("title", ""))
        if score > best_score:
            best_score = score
            best_id = story["id"]

    if best_score >= threshold:
        return best_id
    return None


def _article_image(article: dict[str, Any], fetch_missing: bool = False) -> str | None:
    """Best image for an article; optionally fetch og:image when missing."""
    image = extract_image_url(article)
    if image:
        return image
    if fetch_missing and article.get("url"):
        # SKIP_OG_FETCH=1 skips the network fetch (rss_bulk jobs with large
        # backlogs would otherwise hang on thousands of og:image requests).
        if os.environ.get("SKIP_OG_FETCH") == "1":
            return None
        return fetch_og_image(article["url"])
    return None


def _insert_story_source(supabase, story_id: str, article: dict) -> bool:
    """Link article → story. Returns False if already linked (UNIQUE conflict)."""
    try:
        supabase.table("story_sources").insert({
            "story_id": story_id,
            "article_id": article["id"],
            "source_name": article.get("source_name", ""),
            "source_url": article.get("url", ""),
        }).execute()
        return True
    except Exception as exc:
        if _is_unique_violation(exc):
            logger.info(
                "Article %s already linked to a story — skipping attach",
                article.get("id"),
            )
            return False
        raise


def _create_story(supabase, article: dict, embedding: list[float] | None = None) -> str | None:
    """Create a new story from an article. Returns story ID, or None if already linked."""
    image_url = _article_image(article, fetch_missing=True)
    row = {
        "title": article["title"],
        "summary_en": article.get("summary", ""),
        "source_count": 1,
        "category": normalize_category(
            article.get("category"),
            article.get("title"),
            article.get("summary"),
            article.get("source_domain"),
        ),
        "tags": [],
    }
    if embedding is not None:
        row["embedding"] = embedding
    if image_url:
        row["image_url"] = image_url

    try:
        result = supabase.table("stories").insert(row).execute()
    except Exception:
        # Migration 005 not applied yet — retry without image_url
        row.pop("image_url", None)
        result = supabase.table("stories").insert(row).execute()
    story_id = result.data[0]["id"]

    if not _insert_story_source(supabase, story_id, article):
        # Race: article linked elsewhere — drop the orphan story we just created.
        logger.warning(
            "Article %s already linked; removing orphan story %s",
            article.get("id"),
            story_id,
        )
        try:
            supabase.table("stories").delete().eq("id", story_id).execute()
        except Exception:
            logger.exception("Failed to delete orphan story %s", story_id)
        return None

    return story_id


def _add_to_story(supabase, story_id: str, article: dict) -> bool:
    """Add an article to an existing story. Returns False if already linked."""
    if not _insert_story_source(supabase, story_id, article):
        return False

    # Upgrade the story's category if it is still raw/None and the merged
    # article normalizes to a site slug. Existing site slugs are kept.
    slug = normalize_category(
        article.get("category"),
        article.get("title"),
        article.get("summary"),
        article.get("source_domain"),
    )
    if slug:
        current = (
            supabase.table("stories")
            .select("category")
            .eq("id", story_id)
            .execute()
        )
        if current.data:
            existing = current.data[0].get("category")
            if not is_site_slug(existing):
                supabase.table("stories").update({"category": slug}).eq("id", story_id).execute()

    image = _article_image(article, fetch_missing=False)
    try:
        supabase.rpc(
            "increment_story_source_count",
            {"story_id": story_id, "article_image": image or ""},
        ).execute()
    except Exception:
        # Migration 006 not applied yet — fall back to read-modify-write.
        current = (
            supabase.table("stories")
            .select("source_count")
            .eq("id", story_id)
            .execute()
        )
        if current.data:
            row = current.data[0]
            new_count = (row.get("source_count") or 0) + 1
            update: dict[str, Any] = {"source_count": new_count}
            if image:
                update["image_url"] = image
            try:
                supabase.table("stories").update(update).eq("id", story_id).execute()
            except Exception:
                update.pop("image_url", None)
                supabase.table("stories").update(update).eq("id", story_id).execute()
    return True


def run() -> None:
    try:
        _run_inner()
    except Exception:
        logger.exception("Dedup worker crashed — this should never happen. All articles preserved.")
        raise


def _run_inner() -> None:
    supabase = get_supabase()
    cohere_client = _get_cohere_client()
    use_embeddings = cohere_client is not None

    logger.info("Fetching unprocessed articles...")
    articles = _fetch_unprocessed(supabase, limit=1000)
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

    # Jaccard needs a snapshot of existing stories regardless of embed path.
    story_titles = _load_story_titles(supabase)
    logger.info("Loaded %d existing stories for Jaccard fallback", len(story_titles))

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
                        story_titles, article.get("title", ""), threshold=0.6
                    )
            else:
                story_id = _search_similar_stories_jaccard(
                    story_titles, article.get("title", ""), threshold=0.6
                )

            if story_id:
                if _add_to_story(supabase, story_id, article):
                    merged += 1
            else:
                created_id = _create_story(supabase, article, embedding)
                if created_id:
                    story_titles.append({"id": created_id, "title": article.get("title", "")})
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
    try:
        run()
    except Exception:
        sys.exit(1)
