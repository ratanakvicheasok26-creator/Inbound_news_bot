import { json, preflight } from "../_shared/cors.ts"
import {
  PLAN_CATALOG,
  callPurchase,
  formatAmount,
  isPaywayPlan,
  loadPaywaySecrets,
  newTranId,
  type PaywayCurrency,
} from "../_shared/payway.ts"
import { adminClient, userFromRequest } from "../_shared/supabase.ts"

const LIFETIME_MINUTES = 30

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return preflight()
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405)

  try {
    const user = await userFromRequest(req)
    if (!user) return json({ error: "unauthorized" }, 401)

    let body: {
      plan?: string
      currency?: string
      payment_option?: string
      firstname?: string
      lastname?: string
      phone?: string
    }
    try {
      body = await req.json()
    } catch {
      return json({ error: "invalid_json" }, 400)
    }

    const plan = body.plan ?? ""
    if (!isPaywayPlan(plan)) return json({ error: "invalid_plan" }, 400)

    const currency = (body.currency ?? "USD").toUpperCase() as PaywayCurrency
    if (currency !== "USD" && currency !== "KHR") {
      return json({ error: "invalid_currency" }, 400)
    }

    const catalog = PLAN_CATALOG[plan]
    const khrRate = Number(Deno.env.get("PAYWAY_USD_KHR_RATE") ?? "4100")
    const amountNumber = currency === "KHR" ? Math.round(catalog.amountUsd * khrRate) : catalog.amountUsd
    const amount = formatAmount(amountNumber, currency)

    const admin = adminClient()
    const { data: membership } = await admin
      .from("memberships")
      .select("status, current_period_end")
      .eq("user_id", user.id)
      .maybeSingle()

    if (
      membership &&
      (membership.status === "active" || membership.status === "trialing") &&
      (!membership.current_period_end || new Date(membership.current_period_end).getTime() > Date.now())
    ) {
      return json({ error: "already_member" }, 409)
    }

    const secrets = loadPaywaySecrets()
    const abaTranId = newTranId()
    const expiresAt = new Date(Date.now() + LIFETIME_MINUTES * 60_000).toISOString()
    const email = user.email ?? ""
    const metaName = typeof user.user_metadata?.full_name === "string" ? user.user_metadata.full_name : ""
    const [metaFirst, ...metaRest] = metaName.split(" ")

    const { data: inserted, error: insertError } = await admin
      .from("payway_transactions")
      .insert({
        user_id: user.id,
        aba_tran_id: abaTranId,
        plan,
        amount: amountNumber,
        currency,
        status: "pending",
        expires_at: expiresAt,
        payment_metadata: {
          email,
          payment_option: body.payment_option ?? "abapay_khqr_deeplink",
        },
      })
      .select("*")
      .single()

    if (insertError || !inserted) {
      console.error("payway insert failed", insertError)
      return json({ error: "db_insert_failed" }, 500)
    }

    const checkout = await callPurchase(secrets, {
      tranId: abaTranId,
      amount,
      currency,
      firstname: body.firstname || metaFirst,
      lastname: body.lastname || metaRest.join(" "),
      email,
      phone: body.phone,
      paymentOption: body.payment_option ?? "abapay_khqr_deeplink",
      itemsJson: [{ name: catalog.itemName, quantity: 1, price: Number(amount) }],
      customFields: { user_id: user.id, plan },
      returnParams: JSON.stringify({ user_id: user.id, plan, aba_tran_id: abaTranId }),
      lifetimeMinutes: LIFETIME_MINUTES,
    })

    await admin
      .from("payway_transactions")
      .update({
        payment_metadata: {
          ...(inserted.payment_metadata as Record<string, unknown>),
          checkout,
        },
      })
      .eq("id", inserted.id)

    return json({
      transaction: {
        id: inserted.id,
        aba_tran_id: abaTranId,
        plan,
        amount: amountNumber,
        currency,
        status: "pending",
        expires_at: expiresAt,
      },
      checkout: {
        qr_string: checkout.qr_string,
        qr_image: checkout.qr_image,
        abapay_deeplink: checkout.abapay_deeplink,
        checkout_url: checkout.checkout_qr_url,
        checkout_html: checkout.checkout_html,
      },
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown_error"
    if (message === "payway_not_configured") return json({ error: "payway_not_configured" }, 503)
    console.error("create-payway-transaction", err)
    return json({ error: "purchase_failed", detail: message }, 502)
  }
})
