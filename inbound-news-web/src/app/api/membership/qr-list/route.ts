import { NextRequest, NextResponse } from "next/server"
import { isAdminRequest } from "@/lib/admin"
import { supabaseAdmin } from "@/lib/supabase-server"

/** All QR payment submissions — admin only (verified against ADMIN_EMAILS). */
export async function GET(req: NextRequest) {
  if (!(await isAdminRequest(req))) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 })
  }
  if (!supabaseAdmin) {
    return NextResponse.json({ error: "not_configured" }, { status: 503 })
  }

  const { data } = await supabaseAdmin
    .from("payment_submissions")
    .select(
      "id, user_id, user_email, plan, amount, currency, aba_transaction_id, payment_proof_url, status, created_at, reviewed_at",
    )
    .order("created_at", { ascending: false })
    .limit(200)

  return NextResponse.json({ submissions: data ?? [] })
}
