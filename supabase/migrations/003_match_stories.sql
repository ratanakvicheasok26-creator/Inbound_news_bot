-- Inbound Reports — match_stories RPC for website dedup (workers/dedup.py).
-- Prerequisite: pgvector extension must be enabled (see 001_ingestion_schema.sql).
CREATE EXTENSION IF NOT EXISTS vector;

-- Cosine similarity search over stories.embedding (VECTOR(1024) — Cohere embed-multilingual-v3.0).
CREATE OR REPLACE FUNCTION match_stories(
  query_embedding VECTOR(1024),
  match_threshold FLOAT DEFAULT 0.85,
  match_count INT DEFAULT 1
)
RETURNS TABLE (
  id UUID,
  title TEXT,
  summary_en TEXT,
  source_count INT,
  category TEXT,
  tags TEXT[],
  similarity FLOAT
)
LANGUAGE sql
STABLE
AS $$
  SELECT
    s.id,
    s.title,
    s.summary_en,
    s.source_count,
    s.category,
    s.tags,
    (1 - (s.embedding <=> query_embedding))::FLOAT AS similarity
  FROM stories AS s
  WHERE s.embedding IS NOT NULL
    AND (1 - (s.embedding <=> query_embedding)) >= match_threshold
  ORDER BY s.embedding <=> query_embedding
  LIMIT match_count;
$$;

-- Service role (ingestion workers) and authenticated callers may execute.
GRANT EXECUTE ON FUNCTION match_stories(VECTOR(1024), FLOAT, INT) TO service_role;
GRANT EXECUTE ON FUNCTION match_stories(VECTOR(1024), FLOAT, INT) TO authenticated;
