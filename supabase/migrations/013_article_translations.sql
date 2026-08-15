-- AI-generated Khmer article translations (shared cache).
-- Translations are generated once per article and reused by every member, so
-- the AI is not called repeatedly for the same content (cost optimization).
-- The UI language is free; the depth of Khmer content is gated by membership
-- in the application layer via lib/access.ts — not in this table.

CREATE TABLE IF NOT EXISTS public.article_translations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  article_id UUID NOT NULL REFERENCES public.articles(id) ON DELETE CASCADE,
  language TEXT NOT NULL DEFAULT 'km' CHECK (language IN ('en', 'km')),
  translated_title TEXT NOT NULL,
  translated_summary TEXT,
  translated_content TEXT,
  -- Optional hash of the source text used to invalidate stale translations
  -- when the source article is re-ingested with new content.
  source_text_hash TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (article_id, language)
);

CREATE INDEX IF NOT EXISTS idx_article_translations_article
  ON public.article_translations (article_id);

-- Authenticated users may read the shared translation cache (any translation,
-- not just their own — the cache is community-wide) and may add new
-- translations. The API route enforces plan-based depth and rate limits.
ALTER TABLE public.article_translations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read translations" ON public.article_translations
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated can insert translations" ON public.article_translations
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Authenticated can update translations" ON public.article_translations
  FOR UPDATE USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');

-- Trigger to keep updated_at fresh.
CREATE OR REPLACE TRIGGER article_translations_updated_at
  BEFORE UPDATE ON public.article_translations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
