import { NextRequest, NextResponse } from "next/server"
import { adminUser } from "@/lib/admin"
import { supabaseAdmin } from "@/lib/supabase-server"
import type { MembershipPlan } from "@/lib/plans"

type Submission = {
  id: string
  user_id: string
  plan: MembershipPlan
  status: string
}

function periodEnd(plan: MembershipPlan, start: Date): string {
  const d = new Date(start)
  if (plan === "pro_monthly") d.setMonth(d.getMonth() + 1)
  else d.setFullYear(d.getFullYear() + 1)
  return d.toISOString()
}

/** Admin verifies a QR payment: approve → activates membership, or reject. */
export async function POST(req: NextRequest) {
  const admin = await adminUser(req)
  if (!admin) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 })
  }
  if (!supabaseAdmin) {
    return NextResponse.json({ error: "not_configured" }, { status: 503 })
  }

  let body: { id?: string; action?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "bad_request" }, { status: 400 })
  }

  const { id, action } = body
  if (!id || (action !== "approve" && action !== "reject")) {
    return NextResponse.json({ error: "bad_request" }, { status: 400 })
  }

  const { data: submission, error: fetchError } = await supabaseAdmin
    .from("payment_submissions")
    .select("id, user_id, plan, status")
    .eq("id", id)
    .single()

  if (fetchError || !submission) {
    return NextResponse.json({ error: "not_found" }, { status: 404 })
  }
  const sub = submission as unknown as Submission
  if (sub.status !== "pending") {
    return NextResponse.json(
      { error: "already_reviewed", status: sub.status },
      { status: 409 },
    )
  }

  if (action === "approve") {
    const now = new Date()
    const { error: upsertError } = await supabaseAdmin.from("memberships").upsert(
      {
        user_id: sub.user_id,
        plan: sub.plan,
        status: "active",
        stripe_customer_id: null,
        stripe_subscription_id: null,
        current_period_start: now.toISOString(),
        current_period_end: periodEnd(sub.plan, now),
        cancel_at_period_end: false,
      },
      { onConflict: "user_id" },
    )
    if (upsertError) {
      console.error("qr-review upsert membership error:", upsertError)
      return NextResponse.json({ error: "failed" }, { status: 500 })
    }
  }

  const { error: updateError } = await supabaseAdmin
    .from("payment_submissions")
    .update({ status: action, reviewed_at: new Date().toISOString(), verified_by: admin.user.id })
    .eq("id", id)

  if (updateError) {
    console.error("qr-review update error:", updateError)
    return NextResponse.json({ error: "failed" }, { status: 500 })
  }

  return NextResponse.json({ ok: true, status: action })
}
