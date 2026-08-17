import { NextRequest, NextResponse } from "next/server"
import { adminUser } from "@/lib/admin"
import { supabaseAdmin } from "@/lib/supabase-server"

export async function GET(req: NextRequest) {
  const admin = await adminUser(req)
  if (!admin) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 })
  }
  if (!supabaseAdmin) {
    return NextResponse.json({ error: "not_configured" }, { status: 503 })
  }

  const { data, error } = await supabaseAdmin
    .from("payment_orders")
    .select("id, user_id, user_email, order_id, payment_code, plan, amount, currency, status, transaction_code, created_at, submitted_at, reviewed_at, verified_by")
    .order("created_at", { ascending: false })
    .limit(200)

  if (error) {
    console.error("admin payments list error:", error)
    return NextResponse.json({ error: "failed" }, { status: 500 })
  }

  return NextResponse.json({ orders: data ?? [] })
}
