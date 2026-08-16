-- Add Khmer title and summary columns to stories table.
-- These are populated by the KM bot after translating EN posts,
-- so the website can display Khmer content without real-time AI calls.

ALTER TABLE public.stories
ADD COLUMN IF NOT EXISTS title_km TEXT,
ADD COLUMN IF NOT EXISTS summary_km TEXT;

-- Index for filtering stories with Khmer content (optional, for admin queries)
CREATE INDEX IF NOT EXISTS idx_stories_title_km ON public.stories (title_km) WHERE title_km IS NOT NULL;
