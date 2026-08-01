-- Inbound Reports — dedup hardening
-- Run after 001_ingestion_schema.sql and 005_image_urls.sql.

-- 1. Prevent duplicate story_sources rows (same article linked twice to a story).
--    Makes dedup idempotent: re-running cannot inflate source_count.
ALTER TABLE story_sources
  ADD CONSTRAINT story_sources_story_article_unique UNIQUE (story_id, article_id);

-- 2. Vector index for match_stories (cosine similarity).
--    HNSW needs no periodic rebuild (unlike ivfflat) and works on any row count.
--    Requires pgvector >= 0.5.0 (Supabase ships this).
CREATE INDEX IF NOT EXISTS stories_embedding_idx
  ON stories USING hnsw (embedding vector_cosine_ops);

-- 3. Index used by workers/dedup.py + workers/backfill_images.py.
CREATE INDEX IF NOT EXISTS idx_articles_ingested ON articles(ingested_at DESC);

-- 4. Atomic source_count: increment in a single statement instead of
--    read-modify-write from the worker (avoids lost updates on overlap).
CREATE OR REPLACE FUNCTION increment_story_source_count(story_id UUID, article_image TEXT DEFAULT NULL)
RETURNS INT
LANGUAGE plpgsql
AS $$
DECLARE
  new_count INT;
BEGIN
  UPDATE stories
  SET source_count = source_count + 1,
      image_url = COALESCE(image_url, article_image)
  WHERE id = story_id
  RETURNING source_count INTO new_count;
  RETURN new_count;
END;
$$;

GRANT EXECUTE ON FUNCTION increment_story_source_count(UUID, TEXT) TO service_role;
