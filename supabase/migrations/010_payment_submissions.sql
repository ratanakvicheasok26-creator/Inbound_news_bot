-- QR (ABA/KHQR) payment confirmations.
-- Users pay by scanning a plan's QR, then submit their ABA transaction ID here.
-- The site admin verifies the payment in their ABA app and approves/rejects it.
-- Approval writes/updates the user's row in `memberships`, which unlocks premium.
--
-- Users can read/submit their own rows; the admin reviews via the service role
-- (server-side), which bypasses RLS.

CREATE TABLE IF NOT EXISTS public.payment_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  user_email TEXT,
  plan TEXT NOT NULL CHECK (plan IN ('pro_monthly', 'premium_yearly')),
  amount NUMERIC(10,2) NOT NULL,
  aba_transaction_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'rejected')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  reviewed_at TIMESTAMPTZ,
  CONSTRAINT payment_submissions_user_txn_key UNIQUE (user_id, aba_transaction_id)
);

ALTER TABLE public.payment_submissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Submissions select own" ON public.payment_submissions
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Submissions insert own" ON public.payment_submissions
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_payment_submissions_status
  ON public.payment_submissions (status, created_at);
