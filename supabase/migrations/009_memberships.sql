-- Memberships / subscriptions (Stripe-backed) + premium story flag.
-- Gate = "premium stories / early access": stories.premium = true are readable
-- in full only by members with an active (or trialing) membership row.
-- Public users may read their own row; only service_role writes (Stripe webhook).

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

ALTER TABLE public.memberships ENABLE ROW LEVEL SECURITY;

-- Users can see/manage only their own subscription row.
CREATE POLICY "Memberships select own" ON public.memberships
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Memberships insert own" ON public.memberships
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Memberships update own" ON public.memberships
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_memberships_customer ON public.memberships (stripe_customer_id);
CREATE INDEX IF NOT EXISTS idx_memberships_subscription ON public.memberships (stripe_subscription_id);

-- Premium story flag (full body gated behind an active membership).
ALTER TABLE public.stories ADD COLUMN IF NOT EXISTS premium BOOLEAN NOT NULL DEFAULT FALSE;
CREATE INDEX IF NOT EXISTS idx_stories_premium ON public.stories (premium) WHERE premium = TRUE;

-- Membership helper for RLS-friendly checks.
-- NULL period end (grace between checkout and first subscription event) counts as active.
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
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_active_member() TO authenticated;
