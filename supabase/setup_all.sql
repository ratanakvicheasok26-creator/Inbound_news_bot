-- ============================================================
-- INBOUND NEWS — FULL DATABASE SETUP
-- Run this in Supabase Dashboard → SQL Editor → New query
-- It creates all 9 tables, functions, triggers, RLS policies,
-- and storage buckets. Safe to run multiple times (uses IF NOT EXISTS).
-- ============================================================

-- ============================================================
-- 001: Ingestion Schema
-- ============================================================
CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS articles (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  summary TEXT,
  url TEXT UNIQUE NOT NULL,
  source_name TEXT,
  source_domain TEXT,
  category TEXT,
  language TEXT DEFAULT 'en',
  published_at TIMESTAMPTZ,
  ingested_at TIMESTAMPTZ DEFAULT NOW(),
  raw_json JSONB
);

CREATE TABLE IF NOT EXISTS stories (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  summary_en TEXT,
  source_count INT DEFAULT 1,
  category TEXT,
  tags TEXT[],
  embedding VECTOR(1024),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS story_sources (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  story_id UUID REFERENCES stories(id) ON DELETE CASCADE,
  article_id UUID REFERENCES articles(id) ON DELETE CASCADE,
  source_name TEXT,
  source_url TEXT
);

CREATE INDEX IF NOT EXISTS idx_articles_domain ON articles(source_domain);
CREATE INDEX IF NOT EXISTS idx_articles_published ON articles(published_at DESC);
CREATE INDEX IF NOT EXISTS idx_articles_category ON articles(category);
CREATE INDEX IF NOT EXISTS idx_articles_language ON articles(language);
CREATE INDEX IF NOT EXISTS idx_stories_category ON stories(category);
CREATE INDEX IF NOT EXISTS idx_stories_created ON stories(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_story_sources_story ON story_sources(story_id);
CREATE INDEX IF NOT EXISTS idx_story_sources_article ON story_sources(article_id);

ALTER TABLE articles ENABLE ROW LEVEL SECURITY;
ALTER TABLE stories ENABLE ROW LEVEL SECURITY;
ALTER TABLE story_sources ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Public can read articles' AND tablename = 'articles') THEN
    CREATE POLICY "Public can read articles" ON articles FOR SELECT USING (true);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Public can read stories' AND tablename = 'stories') THEN
    CREATE POLICY "Public can read stories" ON stories FOR SELECT USING (true);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Public can read story_sources' AND tablename = 'story_sources') THEN
    CREATE POLICY "Public can read story_sources" ON story_sources FOR SELECT USING (true);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Service role can manage articles' AND tablename = 'articles') THEN
    CREATE POLICY "Service role can manage articles" ON articles FOR ALL USING (auth.role() = 'service_role');
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Service role can manage stories' AND tablename = 'stories') THEN
    CREATE POLICY "Service role can manage stories" ON stories FOR ALL USING (auth.role() = 'service_role');
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Service role can manage story_sources' AND tablename = 'story_sources') THEN
    CREATE POLICY "Service role can manage story_sources" ON story_sources FOR ALL USING (auth.role() = 'service_role');
  END IF;
END $$;

-- ============================================================
-- 002: Profiles & Auth
-- ============================================================
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT DEFAULT 'Reader',
  default_tier TEXT DEFAULT 'standard' CHECK (default_tier IN ('eli5', 'standard', 'deep')),
  default_lang TEXT DEFAULT 'en' CHECK (default_lang IN ('en', 'km')),
  stealth_mode BOOLEAN DEFAULT false,
  telegram_digest BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name)
  VALUES (new.id, COALESCE(new.raw_user_meta_data->>'display_name', 'Reader'));
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can view own profile' AND tablename = 'profiles') THEN
    CREATE POLICY "Users can view own profile" ON profiles FOR SELECT USING (auth.uid() = id);
  END IF;
END $$;

DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
CREATE POLICY "Users can update own profile" ON profiles
  FOR UPDATE USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "Users can insert own profile" ON profiles;
CREATE POLICY "Users can insert own profile" ON profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS profiles_updated_at ON profiles;
CREATE TRIGGER profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- ============================================================
-- 003: match_stories RPC
-- ============================================================
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
LANGUAGE sql STABLE AS $$
  SELECT s.id, s.title, s.summary_en, s.source_count, s.category, s.tags,
    (1 - (s.embedding <=> query_embedding))::FLOAT AS similarity
  FROM stories AS s
  WHERE s.embedding IS NOT NULL
    AND (1 - (s.embedding <=> query_embedding)) >= match_threshold
  ORDER BY s.embedding <=> query_embedding
  LIMIT match_count;
$$;

GRANT EXECUTE ON FUNCTION match_stories(VECTOR(1024), FLOAT, INT) TO service_role;
GRANT EXECUTE ON FUNCTION match_stories(VECTOR(1024), FLOAT, INT) TO authenticated;

-- ============================================================
-- 005: Image URLs
-- ============================================================
ALTER TABLE articles ADD COLUMN IF NOT EXISTS image_url TEXT;
ALTER TABLE stories ADD COLUMN IF NOT EXISTS image_url TEXT;
CREATE INDEX IF NOT EXISTS idx_articles_image ON articles(image_url) WHERE image_url IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_stories_image ON stories(image_url) WHERE image_url IS NOT NULL;

-- ============================================================
-- 006: Dedup Hardening
-- ============================================================
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'story_sources_story_article_unique') THEN
    ALTER TABLE story_sources ADD CONSTRAINT story_sources_story_article_unique UNIQUE (story_id, article_id);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS stories_embedding_idx ON stories USING hnsw (embedding vector_cosine_ops);
CREATE INDEX IF NOT EXISTS idx_articles_ingested ON articles(ingested_at DESC);

CREATE OR REPLACE FUNCTION increment_story_source_count(story_id UUID, article_image TEXT DEFAULT NULL)
RETURNS INT LANGUAGE plpgsql AS $$
DECLARE new_count INT;
BEGIN
  UPDATE stories SET source_count = source_count + 1, image_url = COALESCE(image_url, article_image)
  WHERE id = story_id RETURNING source_count INTO new_count;
  RETURN new_count;
END;
$$;

GRANT EXECUTE ON FUNCTION increment_story_source_count(UUID, TEXT) TO service_role;

-- ============================================================
-- 007: story_sources article uniqueness
-- ============================================================
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'story_sources_article_unique') THEN
    ALTER TABLE story_sources ADD CONSTRAINT story_sources_article_unique UNIQUE (article_id);
  END IF;
END $$;

-- ============================================================
-- 008: Sponsors
-- ============================================================
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

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Public can read active sponsors' AND tablename = 'sponsors') THEN
    CREATE POLICY "Public can read active sponsors" ON sponsors FOR SELECT
      USING (active = true AND (starts_at IS NULL OR starts_at <= NOW()) AND (ends_at IS NULL OR ends_at > NOW()));
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Service role can manage sponsors' AND tablename = 'sponsors') THEN
    CREATE POLICY "Service role can manage sponsors" ON sponsors FOR ALL
      USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');
  END IF;
END $$;

DROP TRIGGER IF EXISTS sponsors_updated_at ON sponsors;
CREATE TRIGGER sponsors_updated_at
  BEFORE UPDATE ON sponsors
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('sponsor-creatives', 'sponsor-creatives', true, 5242880, ARRAY['image/jpeg','image/png','image/webp','image/gif'])
ON CONFLICT (id) DO UPDATE SET public = EXCLUDED.public, file_size_limit = EXCLUDED.file_size_limit, allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "Public read sponsor creatives" ON storage.objects;
CREATE POLICY "Public read sponsor creatives" ON storage.objects FOR SELECT USING (bucket_id = 'sponsor-creatives');
DROP POLICY IF EXISTS "Service role manage sponsor creatives" ON storage.objects;
CREATE POLICY "Service role manage sponsor creatives" ON storage.objects FOR ALL
  USING (bucket_id = 'sponsor-creatives' AND auth.role() = 'service_role')
  WITH CHECK (bucket_id = 'sponsor-creatives' AND auth.role() = 'service_role');

-- ============================================================
-- 009: Memberships
-- ============================================================
CREATE TABLE IF NOT EXISTS memberships (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  plan TEXT NOT NULL CHECK (plan IN ('pro_monthly', 'premium_yearly')),
  status TEXT NOT NULL CHECK (status IN ('trialing', 'active', 'past_due', 'canceled', 'incomplete', 'unpaid')),
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT UNIQUE,
  current_period_start TIMESTAMPTZ,
  current_period_end TIMESTAMPTZ,
  cancel_at_period_end BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE memberships ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Memberships select own' AND tablename = 'memberships') THEN
    CREATE POLICY "Memberships select own" ON memberships FOR SELECT USING (auth.uid() = user_id);
  END IF;
END $$;

DROP POLICY IF EXISTS "Memberships update own" ON memberships;
DROP POLICY IF EXISTS "Memberships insert own" ON memberships;

CREATE INDEX IF NOT EXISTS idx_memberships_customer ON memberships (stripe_customer_id);
CREATE INDEX IF NOT EXISTS idx_memberships_subscription ON memberships (stripe_subscription_id);

ALTER TABLE stories ADD COLUMN IF NOT EXISTS premium BOOLEAN NOT NULL DEFAULT FALSE;
CREATE INDEX IF NOT EXISTS idx_stories_premium ON stories (premium) WHERE premium = TRUE;

CREATE OR REPLACE FUNCTION is_active_member()
RETURNS BOOLEAN LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT EXISTS (
    SELECT 1 FROM memberships m
    WHERE m.user_id = auth.uid()
      AND m.status IN ('trialing', 'active')
      AND (m.current_period_end IS NULL OR m.current_period_end > NOW())
  );
$$;

GRANT EXECUTE ON FUNCTION is_active_member() TO authenticated;

-- ============================================================
-- 010: Payment Submissions
-- ============================================================
CREATE TABLE IF NOT EXISTS payment_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  user_email TEXT,
  plan TEXT NOT NULL CHECK (plan IN ('pro_monthly', 'premium_yearly')),
  amount NUMERIC(10,2) NOT NULL,
  aba_transaction_id TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  reviewed_at TIMESTAMPTZ,
  currency TEXT NOT NULL DEFAULT 'USD',
  payment_proof_url TEXT,
  verified_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  CONSTRAINT payment_submissions_user_txn_key UNIQUE (user_id, aba_transaction_id)
);

ALTER TABLE payment_submissions ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Submissions select own' AND tablename = 'payment_submissions') THEN
    CREATE POLICY "Submissions select own" ON payment_submissions FOR SELECT USING (auth.uid() = user_id);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Submissions insert own' AND tablename = 'payment_submissions') THEN
    CREATE POLICY "Submissions insert own" ON payment_submissions FOR INSERT WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_payment_submissions_status ON payment_submissions (status, created_at);

INSERT INTO storage.buckets (id, name, public)
VALUES ('payment_proofs', 'payment_proofs', false)
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- 013: Article Translations
-- ============================================================
CREATE TABLE IF NOT EXISTS article_translations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  article_id UUID NOT NULL REFERENCES articles(id) ON DELETE CASCADE,
  language TEXT NOT NULL DEFAULT 'km' CHECK (language IN ('en', 'km')),
  translated_title TEXT NOT NULL,
  translated_summary TEXT,
  translated_content TEXT,
  source_text_hash TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (article_id, language)
);

CREATE INDEX IF NOT EXISTS idx_article_translations_article ON article_translations (article_id);

ALTER TABLE article_translations ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Authenticated can read translations' AND tablename = 'article_translations') THEN
    CREATE POLICY "Authenticated can read translations" ON article_translations FOR SELECT USING (auth.role() = 'authenticated');
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Authenticated can insert translations' AND tablename = 'article_translations') THEN
    CREATE POLICY "Authenticated can insert translations" ON article_translations FOR INSERT WITH CHECK (auth.role() = 'authenticated');
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Authenticated can update translations' AND tablename = 'article_translations') THEN
    CREATE POLICY "Authenticated can update translations" ON article_translations FOR UPDATE USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');
  END IF;
END $$;

DROP TRIGGER IF EXISTS article_translations_updated_at ON article_translations;
CREATE TRIGGER article_translations_updated_at
  BEFORE UPDATE ON article_translations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- ============================================================
-- 014: Khmer Story Fields
-- ============================================================
ALTER TABLE stories ADD COLUMN IF NOT EXISTS title_km TEXT;
ALTER TABLE stories ADD COLUMN IF NOT EXISTS summary_km TEXT;
CREATE INDEX IF NOT EXISTS idx_stories_title_km ON stories (title_km) WHERE title_km IS NOT NULL;

-- ============================================================
-- 015: Payment Orders
-- ============================================================
CREATE TABLE IF NOT EXISTS payment_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  user_email TEXT,
  order_id TEXT UNIQUE NOT NULL,
  payment_code TEXT UNIQUE NOT NULL,
  plan TEXT NOT NULL CHECK (plan IN ('pro_monthly', 'premium_yearly')),
  amount NUMERIC(10,2) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'USD',
  status TEXT NOT NULL DEFAULT 'created' CHECK (status IN ('created', 'pending', 'approved', 'rejected')),
  transaction_code TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  submitted_at TIMESTAMPTZ,
  reviewed_at TIMESTAMPTZ,
  verified_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_payment_orders_user ON payment_orders (user_id);
CREATE INDEX IF NOT EXISTS idx_payment_orders_status ON payment_orders (status);
CREATE INDEX IF NOT EXISTS idx_payment_orders_code ON payment_orders (payment_code);

ALTER TABLE payment_orders ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Payment orders select own' AND tablename = 'payment_orders') THEN
    CREATE POLICY "Payment orders select own" ON payment_orders FOR SELECT USING (auth.uid() = user_id);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Payment orders insert own' AND tablename = 'payment_orders') THEN
    CREATE POLICY "Payment orders insert own" ON payment_orders FOR INSERT WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

-- ============================================================
-- CREATE PROFILE FOR EXISTING USER
-- Replace YOUR_USER_UUID_HERE with your actual user ID from
-- Supabase Dashboard → Authentication → Users
-- ============================================================
-- INSERT INTO profiles (id, display_name)
-- VALUES ('YOUR_USER_UUID_HERE', 'Vichea')
-- ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- DONE! Run verify_setup.sql to check everything is set up.
-- ============================================================
