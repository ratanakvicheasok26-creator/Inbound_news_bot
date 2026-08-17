import { NextRequest, NextResponse } from "next/server"
import { adminUser } from "@/lib/admin"
import { supabaseAdmin } from "@/lib/supabase-server"
import type { MembershipPlan } from "@/lib/plans"

function periodEnd(plan: MembershipPlan, start: Date): string {
  const d = new Date(start)
  if (plan === "pro_monthly") d.setMonth(d.getMonth() + 1)
  else d.setFullYear(d.getFullYear() + 1)
  return d.toISOString()
}

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

  const { data: order, error: fetchError } = await supabaseAdmin
    .from("payment_orders")
    .select("id, user_id, plan, status")
    .eq("id", id)
    .single()

  if (fetchError || !order) {
    return NextResponse.json({ error: "not_found" }, { status: 404 })
  }

  if (order.status !== "pending") {
    return NextResponse.json(
      { error: "already_reviewed", current_status: order.status },
      { status: 409 },
    )
  }

  if (action === "approve") {
    const { data: existingMember } = await supabaseAdmin
      .from("memberships")
      .select("stripe_customer_id, stripe_subscription_id, status")
      .eq("user_id", order.user_id)
      .single()

    const hasStripe = existingMember?.stripe_subscription_id && existingMember?.status === "active"

    const now = new Date()
    const { error: upsertError } = await supabaseAdmin.from("memberships").upsert(
      {
        user_id: order.user_id,
        plan: order.plan,
        status: "active",
        stripe_customer_id: hasStripe ? existingMember.stripe_customer_id : null,
        stripe_subscription_id: hasStripe ? existingMember.stripe_subscription_id : null,
        current_period_start: now.toISOString(),
        current_period_end: periodEnd(order.plan, now),
        cancel_at_period_end: false,
      },
      { onConflict: "user_id" },
    )
    if (upsertError) {
      console.error("admin-review upsert membership error:", upsertError)
      return NextResponse.json({ error: "failed" }, { status: 500 })
    }
  }

  const { error: updateError } = await supabaseAdmin
    .from("payment_orders")
    .update({
      status: action === "approve" ? "approved" : "rejected",
      reviewed_at: new Date().toISOString(),
      verified_by: admin.user.id,
    })
    .eq("id", id)
    .eq("status", "pending")

  if (updateError) {
    console.error("admin-review update order error:", updateError)
    return NextResponse.json({ error: "failed" }, { status: 500 })
  }

  return NextResponse.json({ ok: true, status: action === "approve" ? "approved" : "rejected" })
}
