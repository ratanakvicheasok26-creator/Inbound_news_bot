-- ============================================================
-- INBOUND NEWS — FULL DATABASE SETUP
-- 
-- Safe to run multiple times (uses IF NOT EXISTS).
-- Creates all 10 tables, functions, triggers, RLS policies,
-- vector extension, and storage buckets.
-- ============================================================

-- ============================================================
-- STEP 1: EXTENSIONS
-- ============================================================
CREATE EXTENSION IF NOT EXISTS vector;

-- ============================================================
-- STEP 2: CREATE TABLES
-- ============================================================

-- 01. Articles
CREATE TABLE IF NOT EXISTS public.articles (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  summary TEXT,
  url TEXT UNIQUE NOT NULL,
  source_name TEXT,
  source_domain TEXT,
  category TEXT,
  language TEXT DEFAULT 'en',
  image_url TEXT,
  published_at TIMESTAMPTZ,
  ingested_at TIMESTAMPTZ DEFAULT NOW(),
  raw_json JSONB
);

-- 02. Stories
CREATE TABLE IF NOT EXISTS public.stories (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  summary_en TEXT,
  title_km TEXT,
  summary_km TEXT,
  source_count INT DEFAULT 1,
  category TEXT,
  tags TEXT[],
  image_url TEXT,
  premium BOOLEAN NOT NULL DEFAULT FALSE,
  embedding VECTOR(1024),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 03. Story Sources
CREATE TABLE IF NOT EXISTS public.story_sources (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  story_id UUID REFERENCES public.stories(id) ON DELETE CASCADE,
  article_id UUID REFERENCES public.articles(id) ON DELETE CASCADE UNIQUE,
  source_name TEXT,
  source_url TEXT,
  CONSTRAINT story_sources_story_article_unique UNIQUE (story_id, article_id)
);

-- 04. Profiles
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  handle TEXT UNIQUE,
  byline TEXT,
  avatar_url TEXT,
  bio TEXT,
  first_name TEXT,
  last_name TEXT,
  phone TEXT,
  address TEXT,
  newsletter_daily BOOLEAN NOT NULL DEFAULT FALSE,
  newsletter_breaking BOOLEAN NOT NULL DEFAULT FALSE,
  topic_interests TEXT[] NOT NULL DEFAULT '{}',
  theme TEXT NOT NULL DEFAULT 'system' CHECK (theme IN ('light','dark','system')),
  display_name TEXT DEFAULT 'Reader',
  default_tier TEXT DEFAULT 'standard' CHECK (default_tier IN ('eli5', 'standard', 'deep')),
  default_lang TEXT DEFAULT 'en' CHECK (default_lang IN ('en', 'km')),
  stealth_mode BOOLEAN DEFAULT FALSE,
  telegram_digest BOOLEAN DEFAULT FALSE,
  trial_started_at TIMESTAMPTZ NULL,
  trial_ends_at TIMESTAMPTZ NULL,
  trial_used BOOLEAN NOT NULL DEFAULT FALSE,
  membership_status TEXT NOT NULL DEFAULT 'free' CHECK (membership_status IN ('free', 'trial', 'pro', 'expired')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 05. Sponsors
CREATE TABLE IF NOT EXISTS public.sponsors (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  brand TEXT NOT NULL,
  line TEXT NOT NULL,
  cta TEXT NOT NULL DEFAULT 'Learn more',
  href TEXT NOT NULL,
  image_url TEXT NOT NULL,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  weight INT NOT NULL DEFAULT 1 CHECK (weight >= 1 AND weight <= 10),
  placements TEXT[] NOT NULL DEFAULT ARRAY['home', 'homeFeed', 'story', 'brief', 'donate'],
  starts_at TIMESTAMPTZ,
  ends_at TIMESTAMPTZ,
  updated_by BIGINT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 06. Memberships
CREATE TABLE IF NOT EXISTS public.memberships (
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

-- 07. Payment Submissions (Manual ABA transfer)
CREATE TABLE IF NOT EXISTS public.payment_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  user_email TEXT,
  plan TEXT NOT NULL CHECK (plan IN ('pro_monthly', 'premium_yearly')),
  amount NUMERIC(10,2) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'USD',
  aba_transaction_id TEXT,
  payment_proof_url TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  verified_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  reviewed_at TIMESTAMPTZ,
  CONSTRAINT payment_submissions_user_txn_key UNIQUE (user_id, aba_transaction_id)
);

-- 08. Article Translations
CREATE TABLE IF NOT EXISTS public.article_translations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  article_id UUID NOT NULL REFERENCES public.articles(id) ON DELETE CASCADE,
  language TEXT NOT NULL DEFAULT 'km' CHECK (language IN ('en', 'km')),
  translated_title TEXT NOT NULL,
  translated_summary TEXT,
  translated_content TEXT,
  source_text_hash TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (article_id, language)
);

-- 09. Payment Orders
CREATE TABLE IF NOT EXISTS public.payment_orders (
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

-- 10. Email Verifications (OTP Codes)
CREATE TABLE IF NOT EXISTS public.email_verifications (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  token_hash TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- STEP 3: INDEXES
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_articles_domain ON public.articles(source_domain);
CREATE INDEX IF NOT EXISTS idx_articles_published ON public.articles(published_at DESC);
CREATE INDEX IF NOT EXISTS idx_articles_category ON public.articles(category);
CREATE INDEX IF NOT EXISTS idx_articles_language ON public.articles(language);
CREATE INDEX IF NOT EXISTS idx_articles_image ON public.articles(image_url) WHERE image_url IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_articles_ingested ON public.articles(ingested_at DESC);

CREATE INDEX IF NOT EXISTS idx_stories_category ON public.stories(category);
CREATE INDEX IF NOT EXISTS idx_stories_created ON public.stories(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_stories_image ON public.stories(image_url) WHERE image_url IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_stories_premium ON public.stories(premium) WHERE premium = TRUE;
CREATE INDEX IF NOT EXISTS idx_stories_title_km ON public.stories(title_km) WHERE title_km IS NOT NULL;
CREATE INDEX IF NOT EXISTS stories_embedding_idx ON public.stories USING hnsw (embedding vector_cosine_ops);

CREATE INDEX IF NOT EXISTS idx_story_sources_story ON public.story_sources(story_id);
CREATE INDEX IF NOT EXISTS idx_story_sources_article ON public.story_sources(article_id);

CREATE INDEX IF NOT EXISTS idx_profiles_handle ON public.profiles(handle);
CREATE INDEX IF NOT EXISTS idx_profiles_updated_at ON public.profiles(updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_sponsors_active ON public.sponsors(active) WHERE active = TRUE;
CREATE INDEX IF NOT EXISTS idx_sponsors_updated ON public.sponsors(updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_memberships_customer ON public.memberships(stripe_customer_id);
CREATE INDEX IF NOT EXISTS idx_memberships_subscription ON public.memberships(stripe_subscription_id);

CREATE INDEX IF NOT EXISTS idx_payment_submissions_status ON public.payment_submissions(status, created_at);
CREATE INDEX IF NOT EXISTS idx_article_translations_article ON public.article_translations(article_id);

CREATE INDEX IF NOT EXISTS idx_payment_orders_user ON public.payment_orders(user_id);
CREATE INDEX IF NOT EXISTS idx_payment_orders_status ON public.payment_orders(status);
CREATE INDEX IF NOT EXISTS idx_payment_orders_code ON public.payment_orders(payment_code);

CREATE INDEX IF NOT EXISTS idx_email_verifications_email ON public.email_verifications(email);
CREATE INDEX IF NOT EXISTS idx_email_verifications_token_hash ON public.email_verifications(token_hash);

-- ============================================================
-- STEP 4: FUNCTIONS & TRIGGERS
-- ============================================================

-- Function: Auto updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS profiles_updated_at ON public.profiles;
CREATE TRIGGER profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

DROP TRIGGER IF EXISTS sponsors_updated_at ON public.sponsors;
CREATE TRIGGER sponsors_updated_at
  BEFORE UPDATE ON public.sponsors
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

DROP TRIGGER IF EXISTS article_translations_updated_at ON public.article_translations;
CREATE TRIGGER article_translations_updated_at
  BEFORE UPDATE ON public.article_translations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

--- Function: Auto provision profile on user signup with 42-day free trial
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_now       TIMESTAMPTZ := NOW();
  v_trial_end TIMESTAMPTZ := v_now + INTERVAL '42 days';
BEGIN
  INSERT INTO public.profiles (
    id,
    display_name,
    first_name,
    last_name,
    trial_started_at,
    trial_ends_at,
    trial_used,
    membership_status,
    created_at,
    updated_at
  )
  VALUES (
    new.id,
    COALESCE(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1), 'Reader'),
    COALESCE(new.raw_user_meta_data->>'first_name', ''),
    COALESCE(new.raw_user_meta_data->>'last_name', ''),
    v_now,
    v_trial_end,
    TRUE,
    'trial',
    v_now,
    v_now
  )
  ON CONFLICT (id) DO UPDATE SET
    trial_started_at  = COALESCE(profiles.trial_started_at, EXCLUDED.trial_started_at),
    trial_ends_at     = COALESCE(profiles.trial_ends_at, EXCLUDED.trial_ends_at),
    trial_used        = TRUE,
    membership_status = CASE
      WHEN profiles.membership_status = 'pro' THEN 'pro'
      ELSE COALESCE(profiles.membership_status, EXCLUDED.membership_status)
    END;

  RETURN new;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Trigger: protect trial fields from client-side modification
CREATE OR REPLACE FUNCTION public.protect_profile_trial_fields()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF (NULLIF(current_setting('request.jwt.claim.role', true), '') IN ('authenticated', 'anon'))
     OR (CURRENT_USER IN ('authenticated', 'anon')) THEN
    IF NEW.trial_started_at IS DISTINCT FROM OLD.trial_started_at THEN
      RAISE EXCEPTION 'Modification of trial_started_at is unauthorized.' USING ERRCODE = '42501';
    END IF;
    IF NEW.trial_ends_at IS DISTINCT FROM OLD.trial_ends_at THEN
      RAISE EXCEPTION 'Modification of trial_ends_at is unauthorized.' USING ERRCODE = '42501';
    END IF;
    IF NEW.trial_used IS DISTINCT FROM OLD.trial_used THEN
      RAISE EXCEPTION 'Modification of trial_used is unauthorized.' USING ERRCODE = '42501';
    END IF;
    IF NEW.membership_status IS DISTINCT FROM OLD.membership_status THEN
      RAISE EXCEPTION 'Modification of membership_status is unauthorized.' USING ERRCODE = '42501';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_profile_column_security ON public.profiles;
CREATE TRIGGER enforce_profile_column_security
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_profile_trial_fields();

-- Function: Vector similarity match for stories
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
  image_url TEXT,
  similarity FLOAT
) LANGUAGE plpgsql AS $$
BEGIN
  RETURN QUERY
  SELECT
    s.id,
    s.title,
    s.summary_en,
    s.source_count,
    s.category,
    s.tags,
    s.image_url,
    1 - (s.embedding <=> query_embedding) AS similarity
  FROM public.stories s
  WHERE s.embedding IS NOT NULL
    AND 1 - (s.embedding <=> query_embedding) > match_threshold
  ORDER BY s.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- Function: Atomic increment for story source count
CREATE OR REPLACE FUNCTION increment_story_source_count(p_story_id UUID, p_category TEXT DEFAULT NULL)
RETURNS VOID LANGUAGE plpgsql AS $$
BEGIN
  UPDATE public.stories
  SET source_count = source_count + 1,
      category = COALESCE(p_category, category),
      updated_at = NOW()
  WHERE id = p_story_id;
END;
$$;

GRANT EXECUTE ON FUNCTION increment_story_source_count(UUID, TEXT) TO service_role;

-- Function: Check active membership status (paid or active 42-day trial)
CREATE OR REPLACE FUNCTION is_active_member()
RETURNS BOOLEAN LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.memberships m
    WHERE m.user_id = auth.uid()
      AND m.status IN ('trialing', 'active')
      AND (m.current_period_end IS NULL OR m.current_period_end > NOW())
  )
  OR EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid()
      AND p.trial_started_at IS NOT NULL
      AND p.trial_ends_at IS NOT NULL
      AND p.trial_ends_at > NOW()
  );
$$;

GRANT EXECUTE ON FUNCTION is_active_member() TO authenticated, anon;

-- ============================================================
-- STEP 5: ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================
ALTER TABLE public.articles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.story_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sponsors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.article_translations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_verifications ENABLE ROW LEVEL SECURITY;

-- Articles Policies
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Public can read articles' AND tablename = 'articles') THEN
    CREATE POLICY "Public can read articles" ON public.articles FOR SELECT USING (true);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Service role can manage articles' AND tablename = 'articles') THEN
    CREATE POLICY "Service role can manage articles" ON public.articles FOR ALL USING (auth.role() = 'service_role');
  END IF;
END $$;

-- Stories Policies
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Public can read stories' AND tablename = 'stories') THEN
    CREATE POLICY "Public can read stories" ON public.stories FOR SELECT USING (true);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Service role can manage stories' AND tablename = 'stories') THEN
    CREATE POLICY "Service role can manage stories" ON public.stories FOR ALL USING (auth.role() = 'service_role');
  END IF;
END $$;

-- Story Sources Policies
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Public can read story_sources' AND tablename = 'story_sources') THEN
    CREATE POLICY "Public can read story_sources" ON public.story_sources FOR SELECT USING (true);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Service role can manage story_sources' AND tablename = 'story_sources') THEN
    CREATE POLICY "Service role can manage story_sources" ON public.story_sources FOR ALL USING (auth.role() = 'service_role');
  END IF;
END $$;

-- Profiles Policies
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Public read for profiles' AND tablename = 'profiles') THEN
    CREATE POLICY "Public read for profiles" ON public.profiles FOR SELECT USING (true);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Owners can insert own profile' AND tablename = 'profiles') THEN
    CREATE POLICY "Owners can insert own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Owners can update own profile' AND tablename = 'profiles') THEN
    CREATE POLICY "Owners can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Owners can delete own profile' AND tablename = 'profiles') THEN
    CREATE POLICY "Owners can delete own profile" ON public.profiles FOR DELETE USING (auth.uid() = id);
  END IF;
END $$;

-- Sponsors Policies
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Public can read active sponsors' AND tablename = 'sponsors') THEN
    CREATE POLICY "Public can read active sponsors" ON public.sponsors FOR SELECT
      USING (active = true AND (starts_at IS NULL OR starts_at <= NOW()) AND (ends_at IS NULL OR ends_at > NOW()));
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Service role can manage sponsors' AND tablename = 'sponsors') THEN
    CREATE POLICY "Service role can manage sponsors" ON public.sponsors FOR ALL
      USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');
  END IF;
END $$;

-- Memberships Policies
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Memberships select own' AND tablename = 'memberships') THEN
    CREATE POLICY "Memberships select own" ON public.memberships FOR SELECT USING (auth.uid() = user_id);
  END IF;
END $$;

-- Payment Submissions Policies
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Submissions select own' AND tablename = 'payment_submissions') THEN
    CREATE POLICY "Submissions select own" ON public.payment_submissions FOR SELECT USING (auth.uid() = user_id);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Submissions insert own' AND tablename = 'payment_submissions') THEN
    CREATE POLICY "Submissions insert own" ON public.payment_submissions FOR INSERT WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

-- Article Translations Policies
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Authenticated can read translations' AND tablename = 'article_translations') THEN
    CREATE POLICY "Authenticated can read translations" ON public.article_translations FOR SELECT USING (auth.role() = 'authenticated');
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Authenticated can insert translations' AND tablename = 'article_translations') THEN
    CREATE POLICY "Authenticated can insert translations" ON public.article_translations FOR INSERT WITH CHECK (auth.role() = 'authenticated');
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Authenticated can update translations' AND tablename = 'article_translations') THEN
    CREATE POLICY "Authenticated can update translations" ON public.article_translations FOR UPDATE USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');
  END IF;
END $$;

-- Payment Orders Policies
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Payment orders select own' AND tablename = 'payment_orders') THEN
    CREATE POLICY "Payment orders select own" ON public.payment_orders FOR SELECT USING (auth.uid() = user_id);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Payment orders insert own' AND tablename = 'payment_orders') THEN
    CREATE POLICY "Payment orders insert own" ON public.payment_orders FOR INSERT WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

-- Email Verifications Policies
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Service role can manage email verifications' AND tablename = 'email_verifications') THEN
    CREATE POLICY "Service role can manage email verifications" ON public.email_verifications FOR ALL USING (true) WITH CHECK (true);
  END IF;
END $$;

-- ============================================================
-- STEP 6: STORAGE BUCKETS & STORAGE POLICIES
-- ============================================================

-- Bucket 1: sponsor-creatives (Public)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('sponsor-creatives', 'sponsor-creatives', true, 5242880, ARRAY['image/jpeg','image/png','image/webp','image/gif'])
ON CONFLICT (id) DO UPDATE SET public = EXCLUDED.public, file_size_limit = EXCLUDED.file_size_limit, allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "Public read sponsor creatives" ON storage.objects;
CREATE POLICY "Public read sponsor creatives" ON storage.objects FOR SELECT USING (bucket_id = 'sponsor-creatives');
DROP POLICY IF EXISTS "Service role manage sponsor creatives" ON storage.objects;
CREATE POLICY "Service role manage sponsor creatives" ON storage.objects FOR ALL
  USING (bucket_id = 'sponsor-creatives' AND auth.role() = 'service_role')
  WITH CHECK (bucket_id = 'sponsor-creatives' AND auth.role() = 'service_role');

-- Bucket 2: payment_proofs (Private)
INSERT INTO storage.buckets (id, name, public)
VALUES ('payment_proofs', 'payment_proofs', false)
ON CONFLICT (id) DO NOTHING;

-- Bucket 3: avatars (Public)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('avatars', 'avatars', true, 2097152, ARRAY['image/png', 'image/jpeg', 'image/webp', 'image/gif'])
ON CONFLICT (id) DO UPDATE SET public = EXCLUDED.public, file_size_limit = EXCLUDED.file_size_limit, allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "Public read avatars" ON storage.objects;
CREATE POLICY "Public read avatars" ON storage.objects FOR SELECT USING (bucket_id = 'avatars');

DROP POLICY IF EXISTS "Users upload own avatar" ON storage.objects;
CREATE POLICY "Users upload own avatar" ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'avatars' AND auth.role() = 'authenticated' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "Users update own avatar" ON storage.objects;
CREATE POLICY "Users update own avatar" ON storage.objects FOR UPDATE
  USING (bucket_id = 'avatars' AND auth.role() = 'authenticated' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "Users delete own avatar" ON storage.objects;
CREATE POLICY "Users delete own avatar" ON storage.objects FOR DELETE
  USING (bucket_id = 'avatars' AND auth.role() = 'authenticated' AND (storage.foldername(name))[1] = auth.uid()::text);

-- ============================================================
-- DONE!
-- ============================================================
