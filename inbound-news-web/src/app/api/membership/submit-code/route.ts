import { NextRequest, NextResponse } from "next/server"
import { authenticateRequest } from "@/lib/api-auth"
import { supabaseAdmin } from "@/lib/supabase-server"

export async function POST(req: NextRequest) {
  const auth = await authenticateRequest(req)
  if (!auth) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  }
  if (!supabaseAdmin) {
    return NextResponse.json({ error: "server_not_configured" }, { status: 503 })
  }

  let body: { payment_code?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 })
  }

  const paymentCode = (body.payment_code || "").trim().toUpperCase()
  if (!paymentCode) {
    return NextResponse.json({ error: "payment_code_required" }, { status: 400 })
  }

  const { data: order, error: fetchError } = await supabaseAdmin
    .from("payment_orders")
    .select("id, user_id, status, plan")
    .eq("payment_code", paymentCode)
    .maybeSingle()

  if (fetchError || !order) {
    return NextResponse.json({ error: "invalid_code" }, { status: 404 })
  }

  if (order.user_id !== auth.user.id) {
    return NextResponse.json({ error: "code_not_yours" }, { status: 403 })
  }

  if (order.status !== "created") {
    return NextResponse.json(
      { error: "already_submitted", current_status: order.status },
      { status: 409 },
    )
  }

  const { error: updateError } = await supabaseAdmin
    .from("payment_orders")
    .update({
      status: "pending",
      submitted_at: new Date().toISOString(),
    })
    .eq("id", order.id)
    .eq("status", "created")

  if (updateError) {
    console.error("submit-code update error:", updateError)
    return NextResponse.json({ error: "failed" }, { status: 500 })
  }

  return NextResponse.json({ ok: true, status: "pending" })
}
