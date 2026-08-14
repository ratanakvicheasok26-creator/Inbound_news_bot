import { NextRequest, NextResponse } from "next/server"
import { authenticateRequest } from "@/lib/api-auth"
import { adminUser } from "@/lib/admin"
import { createUserClient, supabaseAdmin } from "@/lib/supabase-server"

/**
 * Short-lived signed URL for a payment screenshot. Callers may be:
 *   - the admin (any submission), or
 *   - the user who owns the submission that references this key.
 * The bucket itself is private — no client ever reads it directly.
 */
export async function GET(req: NextRequest) {
  const key = req.nextUrl.searchParams.get("key")
  if (!key) {
    return NextResponse.json({ error: "bad_request" }, { status: 400 })
  }
  if (!supabaseAdmin) {
    return NextResponse.json({ error: "not_configured" }, { status: 503 })
  }

  const auth = await authenticateRequest(req)
  if (!auth) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  }

  const admin = await adminUser(req)
  if (!admin) {
    const supabase = createUserClient(`Bearer ${auth.token}`)
    const { data } = await supabase
      .from("payment_submissions")
      .select("id")
      .eq("user_id", auth.user.id)
      .eq("payment_proof_url", key)
      .maybeSingle()
    if (!data) {
      return NextResponse.json({ error: "forbidden" }, { status: 403 })
    }
  }

  const { data, error } = await supabaseAdmin.storage
    .from("payment_proofs")
    .createSignedUrl(key, 60)
  if (error || !data?.signedUrl) {
    return NextResponse.json({ error: "not_found" }, { status: 404 })
  }

  return NextResponse.json({ url: data.signedUrl })
}
