import { json, preflight } from "../_shared/cors.ts"
import { applyPaywayStatus } from "../_shared/db.ts"
import {
  callCheckTransaction,
  loadPaywaySecrets,
  mapPaywayPaymentStatus,
  verifyPaywayWebhook,
  webhookApv,
  webhookIndicatesSuccess,
  webhookTranId,
} from "../_shared/payway.ts"
import { adminClient } from "../_shared/supabase.ts"

function signatureFrom(req: Request): string | null {
  return (
    req.headers.get("x-payway-hmac-sha512") ??
    req.headers.get("X-PayWay-Hmac-Sha512") ??
    req.headers.get("hash")
  )
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return preflight()
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405)

  const raw = await req.text()
  let parsed: Record<string, unknown> = {}
  try {
    parsed = raw ? (JSON.parse(raw) as Record<string, unknown>) : {}
  } catch {
    return json({ error: "invalid_json" }, 400)
  }

  let secrets
  try {
    secrets = loadPaywaySecrets()
  } catch {
    return json({ error: "payway_not_configured" }, 503)
  }

  const ok = await verifyPaywayWebhook(raw, signatureFrom(req), secrets.hmacKey, parsed)
  if (!ok) {
    console.error("payway webhook: invalid HMAC")
    return json({ error: "invalid_signature" }, 401)
  }

  const tranId = webhookTranId(parsed)
  if (!tranId) return json({ error: "missing_tran_id" }, 400)

  const admin = adminClient()
  const { data: existing } = await admin
    .from("payway_transactions")
    .select("id, status")
    .eq("aba_tran_id", tranId)
    .maybeSingle()

  if (!existing) return json({ error: "unknown_tran_id" }, 404)
  if (existing.status === "completed") return json({ ok: true, status: "completed", duplicate: true })

  try {
    const checked = await callCheckTransaction(secrets, tranId)
    const mapped = mapPaywayPaymentStatus(checked)
    if (mapped.status === "completed" || webhookIndicatesSuccess(parsed)) {
      await applyPaywayStatus(admin, tranId, "completed", mapped.apv ?? webhookApv(parsed), {
        webhook: parsed,
        check: checked,
      })
      return json({ ok: true, status: "completed" })
    }
    if (mapped.status === "failed" || mapped.status === "expired") {
      await applyPaywayStatus(admin, tranId, mapped.status, mapped.apv, {
        webhook: parsed,
        check: checked,
      })
      return json({ ok: true, status: mapped.status })
    }
    await admin
      .from("payway_transactions")
      .update({
        payment_metadata: { webhook: parsed, check: checked },
      })
      .eq("aba_tran_id", tranId)
    return json({ ok: true, status: "pending" })
  } catch (err) {
    console.error("payway webhook handler", err)
    return json({ error: "handler_failed" }, 500)
  }
})
