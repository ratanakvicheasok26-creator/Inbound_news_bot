-- 42-Day Free Pro Trial
-- Extends profiles with trial lifecycle fields.
-- New users automatically receive 42 days of Pro access.
-- Existing users are protected from retroactive trial grants.

-- ── 1. Schema: add trial columns to profiles ────────────────────────────────

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS trial_started_at TIMESTAMPTZ NULL,
  ADD COLUMN IF NOT EXISTS trial_ends_at    TIMESTAMPTZ NULL,
  ADD COLUMN IF NOT EXISTS trial_used       BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS membership_status TEXT NOT NULL DEFAULT 'free'
    CHECK (membership_status IN ('free', 'trial', 'pro', 'expired'));

-- ── 2. Backfill: protect existing users from retroactive trials ─────────────
-- Any account created before this migration gets trial_used = TRUE so the
-- signup trigger will never grant them a trial.

UPDATE public.profiles
SET
  trial_used = TRUE,
  membership_status = CASE
    WHEN membership_status = 'pro' THEN 'pro'
    ELSE 'free'
  END
WHERE trial_used = FALSE;

-- ── 3. Trigger: auto-assign 42-day trial on new user signup ─────────────────

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
    trial_started_at,
    trial_ends_at,
    trial_used,
    membership_status,
    created_at,
    updated_at
  )
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'display_name', 'Reader'),
    v_now,
    v_trial_end,
    TRUE,
    'trial',
    v_now,
    v_now
  )
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
END;
$$;

-- Re-bind trigger (replaces the one from 002_profiles_and_auth.sql)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- ── 4. Column protection: block client-side trial field modification ────────

CREATE OR REPLACE FUNCTION public.protect_profile_trial_fields()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF CURRENT_USER IN ('authenticated', 'anon') THEN
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

-- ── 5. Update is_active_member() to include trial status ────────────────────
-- This is used by RLS policies for premium story gating.

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
      AND p.membership_status = 'trial'
      AND p.trial_ends_at IS NOT NULL
      AND p.trial_ends_at > NOW()
  );
$$;
