-- QR payment proof uploads + audit fields.
--
-- Adds:
--   * currency              – always 'USD' (set server-side, never from the client)
--   * payment_proof_url     – storage key of the user's payment screenshot in the
--                             private `payment_proofs` bucket (never a public URL)
--   * verified_by           – admin user who approved/rejected the submission
--
-- The proof images live in a private storage bucket: no public/authenticated
-- policies are created, so only the service role (server-side upload/read) and
-- short-lived signed URLs (owner/admin viewing) can ever reach them.

ALTER TABLE public.payment_submissions
  ADD COLUMN IF NOT EXISTS currency TEXT NOT NULL DEFAULT 'USD',
  ADD COLUMN IF NOT EXISTS payment_proof_url TEXT,
  ADD COLUMN IF NOT EXISTS verified_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;

-- Private bucket for payment screenshots. Only service_role (server) accesses
-- it; clients get short-lived signed URLs via the API, never the bucket directly.
INSERT INTO storage.buckets (id, name, public)
VALUES ('payment_proofs', 'payment_proofs', false)
ON CONFLICT (id) DO NOTHING;
