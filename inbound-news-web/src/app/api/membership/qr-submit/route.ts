import { NextRequest, NextResponse } from "next/server"
import { authenticateRequest } from "@/lib/api-auth"
import { createUserClient, supabaseAdmin } from "@/lib/supabase-server"
import { PLANS } from "@/lib/plans"
import type { MembershipPlan } from "@/lib/plans"

/** User confirms their QR (ABA) payment by submitting the ABA transaction ID. */
export async function POST(req: NextRequest) {
  const auth = await authenticateRequest(req)
  if (!auth) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  }
  if (!supabaseAdmin) {
    return NextResponse.json({ error: "not_configured" }, { status: 503 })
  }

  let body: { plan?: string; aba_transaction_id?: string; payment_proof_url?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "bad_request" }, { status: 400 })
  }

  const plan = body.plan as MembershipPlan
  if (!PLANS[plan]) {
    return NextResponse.json({ error: "invalid_plan" }, { status: 400 })
  }

  const txnId = String(body.aba_transaction_id || "").trim()
  if (!txnId || txnId.length < 4 || txnId.length > 64) {
    return NextResponse.json(
      { error: "Enter the ABA transaction ID from your payment." },
      { status: 400 },
    )
  }

  const proofKey = String(body.payment_proof_url || "").trim()
  if (!proofKey || !proofKey.startsWith(`${auth.user.id}/`)) {
    return NextResponse.json({ error: "missing_proof" }, { status: 400 })
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

  const amount = PLANS[plan].price
  const { data, error } = await supabaseAdmin
    .from("payment_submissions")
    .insert({
      user_id: auth.user.id,
      user_email: auth.user.email ?? null,
      plan,
      amount,
      currency: "USD",
      aba_transaction_id: txnId,
      payment_proof_url: proofKey,
      status: "pending",
    })
    .select()
    .single()

  if (error) {
    if (error.code === "23505") {
      return NextResponse.json(
        { error: "This transaction ID was already submitted." },
        { status: 409 },
      )
    }
    console.error("qr-submit error:", error)
    return NextResponse.json({ error: "failed" }, { status: 500 })
  }

  return NextResponse.json({ submission: data }, { status: 201 })
}
