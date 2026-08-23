import { NextRequest, NextResponse } from "next/server"
import { authenticateRequest } from "@/lib/api-auth"

async function invokeFunction(name: string, token: string, body: unknown) {
  const base = (process.env.NEXT_PUBLIC_SUPABASE_URL || "").replace(/\/+$/, "")
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ""
  if (!base || !anon) {
    return NextResponse.json({ error: "supabase_not_configured" }, { status: 503 })
  }
  const res = await fetch(`${base}/functions/v1/${name}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      apikey: anon,
    },
    body: JSON.stringify(body),
  })
  const data = await res.json().catch(() => ({}))
  return NextResponse.json(data, { status: res.status })
}

/** Proxy to create-payway-transaction (cookie/JWT auth → Edge Function). */
export async function POST(req: NextRequest) {
  const auth = await authenticateRequest(req)
  if (!auth) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  }
  let body: unknown = {}
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 })
  }
  return invokeFunction("create-payway-transaction", auth.token, body)
}
