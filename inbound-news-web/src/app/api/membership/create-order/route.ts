import { NextRequest, NextResponse } from "next/server"
import { authenticateRequest } from "@/lib/api-auth"
import { supabaseAdmin } from "@/lib/supabase-server"
import { PLANS, isActiveMembership } from "@/lib/plans"
import type { MembershipPlan } from "@/lib/plans"

const CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
const ORDER_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"

function randomCode(len: number, alphabet: string): string {
  let result = ""
  const arr = new Uint8Array(len)
  crypto.getRandomValues(arr)
  for (let i = 0; i < len; i++) result += alphabet[arr[i] % alphabet.length]
  return result
}

function generatePaymentCode(): string {
  return `PAY-${randomCode(8, CODE_CHARS)}`
}

function generateOrderId(): string {
  const now = new Date()
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, "0")
  const d = String(now.getDate()).padStart(2, "0")
  return `ORD-${y}${m}${d}-${randomCode(6, ORDER_CHARS)}`
}

export async function POST(req: NextRequest) {
  const auth = await authenticateRequest(req)
  if (!auth) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  }
  if (!supabaseAdmin) {
    return NextResponse.json({ error: "server_not_configured" }, { status: 503 })
  }

  let body: { plan?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 })
  }

  const plan = body.plan as MembershipPlan | undefined
  if (!plan || !PLANS[plan]) {
    return NextResponse.json({ error: "invalid_plan" }, { status: 400 })
  }

  const existing = await supabaseAdmin
    .from("memberships")
    .select("status, current_period_end")
    .eq("user_id", auth.user.id)
    .maybeSingle()

  if (existing.data && isActiveMembership(existing.data)) {
    return NextResponse.json({ error: "already_member" }, { status: 409 })
  }

  const pending = await supabaseAdmin
    .from("payment_orders")
    .select("id")
    .eq("user_id", auth.user.id)
    .eq("status", "created")
    .eq("plan", plan)
    .maybeSingle()

  if (pending.data) {
    const { data: fullOrder } = await supabaseAdmin
      .from("payment_orders")
      .select("id, order_id, payment_code, plan, amount, currency, status, created_at")
      .eq("id", pending.data.id)
      .single()

    if (fullOrder) {
      return NextResponse.json({ order: fullOrder })
    }
    return NextResponse.json({ error: "failed" }, { status: 500 })
  }

  const paymentCode = generatePaymentCode()
  const orderId = generateOrderId()
  const amount = PLANS[plan].price

  const { data, error } = await supabaseAdmin
    .from("payment_orders")
    .insert({
      user_id: auth.user.id,
      user_email: auth.user.email || null,
      order_id: orderId,
      payment_code: paymentCode,
      plan,
      amount,
      currency: "USD",
      status: "created",
    })
    .select("id, order_id, payment_code, plan, amount, currency, status, created_at")
    .single()

  if (error) {
    console.error("create-order insert error:", error)
    return NextResponse.json({ error: "failed" }, { status: 500 })
  }

  return NextResponse.json({ order: data })
}
