-- Inbound Reports — one article may belong to only one story.
-- Run after 006_dedup_hardening.sql.
--
-- 006 only added UNIQUE(story_id, article_id), which still allows the same
-- article_id to appear on multiple stories. Dedup races / incomplete linked
-- sets produced those duplicates; this migration cleans them and hardens
-- the schema.

-- 1. Keep the oldest row (min id) per article_id; drop the rest.
DELETE FROM story_sources
WHERE id IN (
  SELECT id
  FROM (
    SELECT id,
           ROW_NUMBER() OVER (PARTITION BY article_id ORDER BY id) AS rn
    FROM story_sources
    WHERE article_id IS NOT NULL
  ) ranked
  WHERE rn > 1
);

-- 2. Enforce one story per article at the DB layer.
ALTER TABLE story_sources
  ADD CONSTRAINT story_sources_article_unique UNIQUE (article_id);
