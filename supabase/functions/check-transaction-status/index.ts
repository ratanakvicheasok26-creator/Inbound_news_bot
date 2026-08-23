import { json, preflight } from "../_shared/cors.ts"
import { applyPaywayStatus } from "../_shared/db.ts"
import {
  callCheckTransaction,
  loadPaywaySecrets,
  mapPaywayPaymentStatus,
} from "../_shared/payway.ts"
import { adminClient, userFromRequest } from "../_shared/supabase.ts"

const MAX_BATCH = 40

function isCron(req: Request): boolean {
  const secret = Deno.env.get("PAYWAY_CRON_SECRET")?.trim()
  if (!secret) return false
  const header = req.headers.get("x-cron-secret") ?? ""
  const bearer = req.headers.get("Authorization")?.replace(/^Bearer\s+/i, "") ?? ""
  return header === secret || bearer === secret
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return preflight()
  if (req.method !== "POST" && req.method !== "GET") {
    return json({ error: "method_not_allowed" }, 405)
  }

  let secrets
  try {
    secrets = loadPaywaySecrets()
  } catch {
    return json({ error: "payway_not_configured" }, 503)
  }

  const admin = adminClient()
  const cron = isCron(req)

  let body: { aba_tran_id?: string } = {}
  if (req.method === "POST") {
    try {
      body = (await req.json()) as { aba_tran_id?: string }
    } catch {
      body = {}
    }
  } else {
    const url = new URL(req.url)
    body.aba_tran_id = url.searchParams.get("aba_tran_id") ?? undefined
  }

  if (!cron) {
    const user = await userFromRequest(req)
    if (!user) return json({ error: "unauthorized" }, 401)
    if (!body.aba_tran_id) return json({ error: "missing_aba_tran_id" }, 400)

    const { data: row } = await admin
      .from("payway_transactions")
      .select("*")
      .eq("aba_tran_id", body.aba_tran_id)
      .eq("user_id", user.id)
      .maybeSingle()

    if (!row) return json({ error: "not_found" }, 404)
    const updated = await refreshOne(admin, secrets, row)
    return json({ transaction: updated })
  }

  const { data: pending, error } = await admin
    .from("payway_transactions")
    .select("*")
    .eq("status", "pending")
    .order("created_at", { ascending: true })
    .limit(MAX_BATCH)

  if (error) return json({ error: "query_failed" }, 500)

  const results = []
  for (const row of pending ?? []) {
    try {
      results.push(await refreshOne(admin, secrets, row))
    } catch (err) {
      console.error("check-transaction-status item failed", row.aba_tran_id, err)
      results.push({ aba_tran_id: row.aba_tran_id, status: "error" })
    }
  }
  return json({ ok: true, checked: results.length, results })
})

async function refreshOne(
  admin: ReturnType<typeof adminClient>,
  secrets: ReturnType<typeof loadPaywaySecrets>,
  row: {
    aba_tran_id: string
    status: string
    expires_at: string | null
  },
) {
  if (row.status === "completed") {
    return { aba_tran_id: row.aba_tran_id, status: "completed" }
  }

  const checked = await callCheckTransaction(secrets, row.aba_tran_id)
  const mapped = mapPaywayPaymentStatus(checked)

  if (mapped.status !== "pending") {
    const applied = await applyPaywayStatus(admin, row.aba_tran_id, mapped.status, mapped.apv, {
      check: checked,
    })
    return { aba_tran_id: applied.aba_tran_id, status: applied.status }
  }

  if (row.expires_at && new Date(row.expires_at).getTime() <= Date.now()) {
    const applied = await applyPaywayStatus(admin, row.aba_tran_id, "expired", mapped.apv, {
      check: checked,
      expired_locally: true,
    })
    return { aba_tran_id: applied.aba_tran_id, status: applied.status }
  }

  return { aba_tran_id: row.aba_tran_id, status: "pending" }
}
