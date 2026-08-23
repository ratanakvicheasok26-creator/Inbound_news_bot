-- ABA PayWay transactions: official checkout / KHQR / webhook / status-poll flow.
-- Clients may SELECT their own rows. All inserts/updates go through Edge Functions
-- using the service role (bypasses RLS). Payment status cannot be tampered with
-- from the browser.

CREATE TABLE IF NOT EXISTS public.payway_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  aba_tran_id TEXT NOT NULL UNIQUE,
  plan TEXT CHECK (plan IN ('pro_monthly', 'premium_yearly')),
  amount NUMERIC(12,2) NOT NULL CHECK (amount > 0),
  currency TEXT NOT NULL CHECK (currency IN ('USD', 'KHR')),
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'completed', 'failed', 'expired')),
  payment_metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  expires_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_payway_transactions_user_created
  ON public.payway_transactions (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_payway_transactions_pending
  ON public.payway_transactions (created_at)
  WHERE status = 'pending';

COMMENT ON TABLE public.payway_transactions IS
  'ABA PayWay checkout records. aba_tran_id is the merchant tran_id sent to PayWay (max 20 chars).';

DROP TRIGGER IF EXISTS payway_transactions_updated_at ON public.payway_transactions;
CREATE TRIGGER payway_transactions_updated_at
  BEFORE UPDATE ON public.payway_transactions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

ALTER TABLE public.payway_transactions ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.payway_transactions FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.payway_transactions TO authenticated;
GRANT ALL ON public.payway_transactions TO service_role;

DROP POLICY IF EXISTS "PayWay transactions select own" ON public.payway_transactions;
CREATE POLICY "PayWay transactions select own"
  ON public.payway_transactions
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Users must not insert, update, or delete payment rows (no status tampering).

-- Plan IDs match public.memberships / inbound-news-web/src/lib/plans.ts.

-- Atomically apply a PayWay terminal status. APPROVED (completed) always wins
-- over a prior expired/failed mark so a late webhook still grants membership.
CREATE OR REPLACE FUNCTION public.apply_payway_status(
  p_aba_tran_id TEXT,
  p_status TEXT,
  p_apv TEXT DEFAULT NULL,
  p_metadata JSONB DEFAULT '{}'::jsonb
)
RETURNS public.payway_transactions
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.payway_transactions;
  v_period_end TIMESTAMPTZ;
BEGIN
  IF p_status NOT IN ('pending', 'completed', 'failed', 'expired') THEN
    RAISE EXCEPTION 'invalid payway status: %', p_status;
  END IF;

  SELECT * INTO v_row
  FROM public.payway_transactions
  WHERE aba_tran_id = p_aba_tran_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'payway transaction not found: %', p_aba_tran_id
      USING ERRCODE = 'P0002';
  END IF;

  IF v_row.status = 'completed' THEN
    RETURN v_row;
  END IF;

  IF p_status = 'pending' THEN
    RETURN v_row;
  END IF;

  UPDATE public.payway_transactions
  SET
    status = p_status,
    completed_at = CASE WHEN p_status = 'completed' THEN NOW() ELSE completed_at END,
    payment_metadata = COALESCE(payment_metadata, '{}'::jsonb)
      || COALESCE(p_metadata, '{}'::jsonb)
      || CASE
           WHEN p_apv IS NOT NULL AND length(p_apv) > 0
           THEN jsonb_build_object('apv', p_apv)
           ELSE '{}'::jsonb
         END,
    updated_at = NOW()
  WHERE id = v_row.id
  RETURNING * INTO v_row;

  IF p_status = 'completed' AND v_row.plan IS NOT NULL THEN
    v_period_end := CASE
      WHEN v_row.plan = 'premium_yearly' THEN NOW() + INTERVAL '1 year'
      ELSE NOW() + INTERVAL '1 month'
    END;

    INSERT INTO public.memberships (
      user_id,
      plan,
      status,
      current_period_start,
      current_period_end,
      cancel_at_period_end,
      updated_at
    )
    VALUES (
      v_row.user_id,
      v_row.plan,
      'active',
      NOW(),
      v_period_end,
      FALSE,
      NOW()
    )
    ON CONFLICT (user_id) DO UPDATE SET
      plan = EXCLUDED.plan,
      status = 'active',
      current_period_start = EXCLUDED.current_period_start,
      current_period_end = EXCLUDED.current_period_end,
      cancel_at_period_end = FALSE,
      updated_at = NOW();

    UPDATE public.profiles
    SET
      membership_status = 'pro',
      updated_at = NOW()
    WHERE id = v_row.user_id;
  END IF;

  RETURN v_row;
END;
$$;

REVOKE ALL ON FUNCTION public.apply_payway_status(TEXT, TEXT, TEXT, JSONB) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.apply_payway_status(TEXT, TEXT, TEXT, JSONB) TO service_role;

-- Cron helper: no-ops until Vault secrets payway_status_check_url + payway_cron_auth exist.
CREATE OR REPLACE FUNCTION public.invoke_payway_status_check()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_url TEXT;
  v_auth TEXT;
BEGIN
  BEGIN
    SELECT decrypted_secret INTO v_url
    FROM vault.decrypted_secrets
    WHERE name = 'payway_status_check_url'
    LIMIT 1;

    SELECT decrypted_secret INTO v_auth
    FROM vault.decrypted_secrets
    WHERE name = 'payway_cron_auth'
    LIMIT 1;
  EXCEPTION
    WHEN undefined_table THEN
      RAISE NOTICE 'PayWay status check skipped: vault.decrypted_secrets is not available';
      RETURN;
    WHEN undefined_object THEN
      RAISE NOTICE 'PayWay status check skipped: vault extension is not available';
      RETURN;
  END;

  IF v_url IS NULL OR v_auth IS NULL THEN
    RAISE NOTICE 'PayWay status check skipped: vault secrets payway_status_check_url / payway_cron_auth are not set';
    RETURN;
  END IF;

  PERFORM net.http_post(
    url := v_url,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', v_auth
    ),
    body := jsonb_build_object('source', 'pg_cron')
  );
EXCEPTION
  WHEN undefined_function THEN
    RAISE NOTICE 'PayWay status check skipped: pg_net is not enabled';
END;
$$;

REVOKE ALL ON FUNCTION public.invoke_payway_status_check() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.invoke_payway_status_check() TO postgres, service_role;

DO $$
BEGIN
  PERFORM cron.unschedule('payway-check-pending-transactions');
EXCEPTION
  WHEN undefined_function THEN NULL;
  WHEN undefined_object THEN NULL;
  WHEN OTHERS THEN NULL;
END $$;

DO $$
BEGIN
  PERFORM cron.schedule(
    'payway-check-pending-transactions',
    '*/2 * * * *',
    $$SELECT public.invoke_payway_status_check()$$
  );
EXCEPTION
  WHEN undefined_function THEN
    RAISE NOTICE 'pg_cron is not enabled; schedule check-transaction-status from the Dashboard';
  WHEN insufficient_privilege THEN
    RAISE NOTICE 'Could not schedule pg_cron job (insufficient privilege)';
END $$;
