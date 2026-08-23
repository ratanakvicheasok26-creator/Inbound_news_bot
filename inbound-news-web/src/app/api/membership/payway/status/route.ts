import { NextRequest, NextResponse } from "next/server"
import { authenticateRequest } from "@/lib/api-auth"

/** Proxy to check-transaction-status for the signed-in user's pending PayWay charge. */
export async function POST(req: NextRequest) {
  const auth = await authenticateRequest(req)
  if (!auth) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  }
  const base = (process.env.NEXT_PUBLIC_SUPABASE_URL || "").replace(/\/+$/, "")
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ""
  if (!base || !anon) {
    return NextResponse.json({ error: "supabase_not_configured" }, { status: 503 })
  }

  let body: { aba_tran_id?: string } = {}
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 })
  }
  if (!body.aba_tran_id) {
    return NextResponse.json({ error: "missing_aba_tran_id" }, { status: 400 })
  }

  const res = await fetch(`${base}/functions/v1/check-transaction-status`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${auth.token}`,
      apikey: anon,
    },
    body: JSON.stringify({ aba_tran_id: body.aba_tran_id }),
  })
  const data = await res.json().catch(() => ({}))
  return NextResponse.json(data, { status: res.status })
}
