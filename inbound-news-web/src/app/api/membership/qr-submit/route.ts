import { NextRequest, NextResponse } from "next/server"
import { authenticateRequest } from "@/lib/api-auth"
import { createUserClient, supabaseAdmin } from "@/lib/supabase-server"
import { PLANS } from "@/lib/plans"
import type { MembershipPlan } from "@/lib/plans"

/**
 * Honor-system QR (ABA) payment confirmation. The user pays by scanning the
 * plan's QR, then taps "I've paid" — no transaction ID or screenshot needed.
 * The admin verifies the payment in their own bank app and approves it from
 * /admin/qr.
 */
export async function POST(req: NextRequest) {
  const auth = await authenticateRequest(req)
  if (!auth) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  }
  if (!supabaseAdmin) {
    return NextResponse.json({ error: "not_configured" }, { status: 503 })
  }

  let body: { plan?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "bad_request" }, { status: 400 })
  }

  const plan = body.plan as MembershipPlan
  if (!PLANS[plan]) {
    return NextResponse.json({ error: "invalid_plan" }, { status: 400 })
  }

  const supabase = createUserClient(`Bearer ${auth.token}`)
  const { data: existing } = await supabase
    .from("memberships")
    .select("user_id, status")
    .eq("user_id", auth.user.id)
    .maybeSingle()

  const status = (existing as { status?: string } | null)?.status
  if (status === "active" || status === "trialing") {
    return NextResponse.json({ error: "already_member" }, { status: 409 })
  }

  const { data: pending } = await supabaseAdmin
    .from("payment_submissions")
    .select("id, plan, amount, currency, aba_transaction_id, payment_proof_url, status, created_at, reviewed_at")
    .eq("user_id", auth.user.id)
    .eq("status", "pending")
    .eq("plan", plan)
    .maybeSingle()

  if (pending) {
    return NextResponse.json({ submission: pending }, { status: 200 })
  }

  const { data: otherPending } = await supabaseAdmin
    .from("payment_submissions")
    .select("id, plan")
    .eq("user_id", auth.user.id)
    .eq("status", "pending")
    .maybeSingle()

  if (otherPending) {
    return NextResponse.json(
      { error: "pending_submission_exists", detail: `You already have a pending submission for ${otherPending.plan}. Please wait for it to be reviewed.` },
      { status: 409 },
    )
  }

  const amount = PLANS[plan].price
  const { data, error } = await supabaseAdmin
    .from("payment_submissions")
    .insert({
      user_id: auth.user.id,
      user_email: auth.user.email ?? null,
      plan,
      amount,
      currency: "USD",
      aba_transaction_id: null,
      payment_proof_url: null,
      status: "pending",
    })
    .select()
    .single()

  if (error) {
    console.error("qr-submit error:", error)
    return NextResponse.json({ error: "failed" }, { status: 500 })
  }

  return NextResponse.json({ submission: data }, { status: 201 })
}
