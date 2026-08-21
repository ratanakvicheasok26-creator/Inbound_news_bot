-- =============================================================================
-- Migration: 017_fix_42_day_trial.sql
-- 42-Day (6-Week) Free Pro Trial — Fix & Existing User Enrollment
-- =============================================================================

-- ── 1. Schema: ensure trial columns exist on profiles ─────────────────────────

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS trial_started_at TIMESTAMPTZ NULL,
  ADD COLUMN IF NOT EXISTS trial_ends_at    TIMESTAMPTZ NULL,
  ADD COLUMN IF NOT EXISTS trial_used       BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS membership_status TEXT NOT NULL DEFAULT 'free';

-- Ensure constraint is clean
ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_membership_status_check;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_membership_status_check
  CHECK (membership_status IN ('free', 'trial', 'pro', 'expired'));

-- ── 2. Backfill & Enroll Existing Users ──────────────────────────────────────
-- Rule:
-- 1. If an existing account already has trial_started_at set, KEEP their trial dates.
-- 2. If an account has an active paid subscription in public.memberships or
--    membership_status = 'pro', KEEP them as 'pro' without downgrading.
-- 3. All other existing accounts (where trial_started_at IS NULL) receive a
--    fresh 42-day trial starting NOW.

UPDATE public.profiles p
SET
  trial_started_at  = NOW(),
  trial_ends_at     = NOW() + INTERVAL '42 days',
  trial_used        = TRUE,
  membership_status = 'trial',
  updated_at        = NOW()
WHERE p.trial_started_at IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.memberships m
    WHERE m.user_id = p.id
      AND m.status IN ('trialing', 'active')
      AND (m.current_period_end IS NULL OR m.current_period_end > NOW())
  )
  AND p.membership_status != 'pro';

-- ── 3. Trigger: auto-assign 42-day trial on new user signup ───────────────────
-- Does NOT touch the signup workflow. Supabase Auth trigger automatically
-- provisions the profile with a 42-day trial when a user is created.

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
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1), 'Reader'),
    COALESCE(NEW.raw_user_meta_data->>'first_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'last_name', ''),
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

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- ── 4. Column protection: block client-side trial field modification ─────────

CREATE OR REPLACE FUNCTION public.protect_profile_trial_fields()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Prevent modifications from client (authenticated or anon)
  IF (NULLIF(current_setting('request.jwt.claim.role', true), '') IN ('authenticated', 'anon'))
     OR (CURRENT_USER IN ('authenticated', 'anon')) THEN
    IF NEW.trial_started_at IS DISTINCT FROM OLD.trial_started_at THEN
      RAISE EXCEPTION 'Modification of trial_started_at is unauthorized.'
        USING ERRCODE = '42501';
    END IF;
    IF NEW.trial_ends_at IS DISTINCT FROM OLD.trial_ends_at THEN
      RAISE EXCEPTION 'Modification of trial_ends_at is unauthorized.'
        USING ERRCODE = '42501';
    END IF;
    IF NEW.trial_used IS DISTINCT FROM OLD.trial_used THEN
      RAISE EXCEPTION 'Modification of trial_used is unauthorized.'
        USING ERRCODE = '42501';
    END IF;
    IF NEW.membership_status IS DISTINCT FROM OLD.membership_status THEN
      RAISE EXCEPTION 'Modification of membership_status is unauthorized.'
        USING ERRCODE = '42501';
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

-- ── 5. Helper function: is_active_member() ───────────────────────────────────
-- Evaluates server-side NOW() against trial_ends_at or paid subscription period.

CREATE OR REPLACE FUNCTION public.is_active_member()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
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

GRANT EXECUTE ON FUNCTION public.is_active_member() TO authenticated, anon;
