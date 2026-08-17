-- Payment orders: structured order/payment-code flow replacing the honor-system QR.
-- Status lifecycle: created → pending (code submitted) → approved/rejected (admin)
-- Only service_role (admin API routes) can update status to approved/rejected.
-- Users can only INSERT their own rows and SELECT their own rows.

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

CREATE INDEX IF NOT EXISTS idx_payment_orders_user ON public.payment_orders (user_id);
CREATE INDEX IF NOT EXISTS idx_payment_orders_status ON public.payment_orders (status);
CREATE INDEX IF NOT EXISTS idx_payment_orders_code ON public.payment_orders (payment_code);

-- RLS: users can only read their own orders
ALTER TABLE public.payment_orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Payment orders select own" ON public.payment_orders
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Payment orders insert own" ON public.payment_orders
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- No UPDATE/DELETE policies for users — only service_role can review orders.

-- SECURITY FIX: Drop the user-facing UPDATE and INSERT policies on memberships.
-- All membership writes go through supabaseAdmin (service_role) which bypasses RLS.
-- Without this fix, a user could craft a request to insert/update status='active' on their own row.
DROP POLICY IF EXISTS "Memberships update own" ON public.memberships;
DROP POLICY IF EXISTS "Memberships insert own" ON public.memberships;
