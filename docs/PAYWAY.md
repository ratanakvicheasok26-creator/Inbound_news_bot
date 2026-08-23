# ABA PayWay (official API)

Inbound Reports charges membership through **ABA PayWay**: HMAC-SHA512 signed Purchase + Check Transaction, a verified webhook, and a pending-transaction poller. Honor-system static KHQR remains the fallback when PayWay secrets are not set.

## Secrets (Supabase Edge Function secrets / Vault)

Never put these in Next.js `NEXT_PUBLIC_*` variables.

```bash
supabase secrets set \
  ABA_PAYWAY_MERCHANT_ID=your_merchant_id \
  ABA_PAYWAY_API_URL=https://checkout-sandbox.payway.com.kh \
  ABA_PAYWAY_PUBLIC_KEY=your_hmac_api_key \
  ABA_PAYWAY_RSA_PUBLIC_KEY="-----BEGIN PUBLIC KEY-----\n...\n-----END PUBLIC KEY-----" \
  ABA_PAYWAY_RSA_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----" \
  SITE_URL=https://your-domain \
  PAYWAY_CRON_SECRET=long-random-string \
  PAYWAY_USD_KHR_RATE=4100
```

| Secret | Role |
| --- | --- |
| `ABA_PAYWAY_MERCHANT_ID` | Merchant id from ABA |
| `ABA_PAYWAY_API_URL` | `https://checkout-sandbox.payway.com.kh` or production `https://checkout.payway.com.kh` |
| `ABA_PAYWAY_PUBLIC_KEY` | HMAC-SHA512 API key (PayWay calls this `public_key`) |
| `ABA_PAYWAY_RSA_PUBLIC_KEY` | RSA public key for `merchant_auth` (payment-link / refund) |
| `ABA_PAYWAY_RSA_PRIVATE_KEY` | Matching private key if ABA encrypts payloads to you |
| `SITE_URL` | Used for cancel / continue URLs |
| `PAYWAY_CRON_SECRET` | Shared secret for `check-transaction-status` cron |

Production URL is typically `https://checkout.payway.com.kh`. Confirm with ABA when they go live.

## Database

Apply `supabase/migrations/018_payway_transactions.sql`.

- `payway_transactions` — `id`, `user_id`, `aba_tran_id`, `amount`, `currency` (`USD`/`KHR`), `status` (`pending`/`completed`/`failed`/`expired`), `payment_metadata`, timestamps
- RLS: authenticated users can **SELECT own rows only**. No client INSERT/UPDATE/DELETE
- `apply_payway_status(...)` — service-role only; completed payments upsert `memberships` and set `profiles.membership_status = 'pro'`

Vault secrets for pg_cron (SQL editor):

```sql
select vault.create_secret(
  'https://<project-ref>.supabase.co/functions/v1/check-transaction-status',
  'payway_status_check_url'
);
select vault.create_secret('Bearer <PAYWAY_CRON_SECRET>', 'payway_cron_auth');
```

## Deploy Edge Functions

```bash
supabase functions deploy create-payway-transaction
supabase functions deploy payway-webhook-callback --no-verify-jwt
supabase functions deploy check-transaction-status --no-verify-jwt
```

Whitelist the webhook URL in the PayWay merchant portal:

`https://<project-ref>.supabase.co/functions/v1/payway-webhook-callback`

## Frontend usage

Cookie-authenticated Next.js proxy (this app):

```ts
import { startPaywayCheckout, getPaywayStatus } from "@/lib/membership"

const { transaction, checkout, error } = await startPaywayCheckout("pro_monthly", "USD")
// checkout.qr_string | checkout.qr_image | checkout.abapay_deeplink | checkout.checkout_url

const { status } = await getPaywayStatus(transaction.aba_tran_id)
```

Direct `supabase-js` invoke (when you have a real user JWT):

```ts
const { data, error } = await supabase.functions.invoke("create-payway-transaction", {
  body: { plan: "pro_monthly", currency: "USD" },
})
```

`PaymentModal` tries PayWay first and falls back to the existing static KHQR + payment-code flow if the function returns 503.

## Crypto (PayWay standard)

Purchase / check-transaction hashes: **HMAC-SHA512** of concatenated fields, Base64, keyed by `ABA_PAYWAY_PUBLIC_KEY`.

Webhook: HMAC over PHP `ksort` concatenated values, compared to `X-PayWay-Hmac-Sha512` (hex or Base64).

RSA PKCS#1 v1.5 (`rsaEncryptMerchantAuth`) is implemented for PayWay `merchant_auth` APIs; purchase does not send RSA signatures.
