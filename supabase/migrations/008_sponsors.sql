-- Sponsors / house ads inventory (Telegram-admin + AdBand)
-- Public can read active creatives; only service_role writes.

CREATE TABLE IF NOT EXISTS sponsors (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  brand TEXT NOT NULL,
  line TEXT NOT NULL,
  cta TEXT NOT NULL DEFAULT 'Learn more',
  href TEXT NOT NULL,
  image_url TEXT NOT NULL,
  active BOOLEAN NOT NULL DEFAULT true,
  weight INT NOT NULL DEFAULT 1 CHECK (weight >= 1 AND weight <= 10),
  placements TEXT[] NOT NULL DEFAULT ARRAY['home', 'homeFeed', 'story', 'brief', 'donate'],
  starts_at TIMESTAMPTZ,
  ends_at TIMESTAMPTZ,
  updated_by BIGINT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sponsors_active ON sponsors (active) WHERE active = true;
CREATE INDEX IF NOT EXISTS idx_sponsors_updated ON sponsors (updated_at DESC);

ALTER TABLE sponsors ENABLE ROW LEVEL SECURITY;

-- Anon / authenticated: only currently active & in-window rows
CREATE POLICY "Public can read active sponsors" ON sponsors
  FOR SELECT
  USING (
    active = true
    AND (starts_at IS NULL OR starts_at <= NOW())
    AND (ends_at IS NULL OR ends_at > NOW())
  );

CREATE POLICY "Service role can manage sponsors" ON sponsors
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- Reuse shared updated_at trigger if present (002_profiles_and_auth)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_proc WHERE proname = 'update_updated_at'
  ) THEN
    CREATE TRIGGER sponsors_updated_at
      BEFORE UPDATE ON sponsors
      FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
  END IF;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Public bucket for sponsor poster images (Telegram uploads)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'sponsor-creatives',
  'sponsor-creatives',
  true,
  5242880,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "Public read sponsor creatives" ON storage.objects;
CREATE POLICY "Public read sponsor creatives"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'sponsor-creatives');

DROP POLICY IF EXISTS "Service role manage sponsor creatives" ON storage.objects;
CREATE POLICY "Service role manage sponsor creatives"
  ON storage.objects FOR ALL
  USING (bucket_id = 'sponsor-creatives' AND auth.role() = 'service_role')
  WITH CHECK (bucket_id = 'sponsor-creatives' AND auth.role() = 'service_role');
