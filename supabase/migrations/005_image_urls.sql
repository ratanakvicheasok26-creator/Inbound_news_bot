-- Add image URLs for articles and clustered stories
ALTER TABLE articles ADD COLUMN IF NOT EXISTS image_url TEXT;
ALTER TABLE stories ADD COLUMN IF NOT EXISTS image_url TEXT;

CREATE INDEX IF NOT EXISTS idx_articles_image ON articles(image_url) WHERE image_url IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_stories_image ON stories(image_url) WHERE image_url IS NOT NULL;
