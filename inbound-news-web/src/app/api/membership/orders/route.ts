import { NextRequest, NextResponse } from "next/server"
import { authenticateRequest } from "@/lib/api-auth"
import { supabaseAdmin } from "@/lib/supabase-server"

export async function GET(req: NextRequest) {
  const auth = await authenticateRequest(req)
  if (!auth) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  }
  if (!supabaseAdmin) {
    return NextResponse.json({ error: "server_not_configured" }, { status: 503 })
  }

  const { data, error } = await supabaseAdmin
    .from("payment_orders")
    .select("id, order_id, payment_code, plan, amount, currency, status, transaction_code, created_at, submitted_at, reviewed_at")
    .eq("user_id", auth.user.id)
    .order("created_at", { ascending: false })

  if (error) {
    console.error("orders list error:", error)
    return NextResponse.json({ error: "failed" }, { status: 500 })
  }

  return NextResponse.json({ orders: data ?? [] })
}
