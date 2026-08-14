-- Honor-system QR payments: no transaction ID or screenshot required.
-- The user taps "I've paid" after paying by QR; the admin verifies against
-- their own bank app and approves manually. aba_transaction_id becomes
-- optional (NULL for honor-system submissions).

ALTER TABLE public.payment_submissions
  ALTER COLUMN aba_transaction_id DROP NOT NULL;
