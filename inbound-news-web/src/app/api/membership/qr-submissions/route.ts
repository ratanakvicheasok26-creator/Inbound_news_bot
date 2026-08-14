import { NextRequest, NextResponse } from "next/server"
import { authenticateRequest } from "@/lib/api-auth"
import { createUserClient } from "@/lib/supabase-server"

/** The signed-in user's QR payment submissions (invoice history). */
export async function GET(req: NextRequest) {
  const auth = await authenticateRequest(req)
  if (!auth) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  }

  const supabase = createUserClient(`Bearer ${auth.token}`)
  const { data } = await supabase
    .from("payment_submissions")
    .select("id, plan, amount, currency, aba_transaction_id, payment_proof_url, status, created_at, reviewed_at")
    .eq("user_id", auth.user.id)
    .order("created_at", { ascending: false })

  return NextResponse.json({ submissions: data ?? [] })
}
