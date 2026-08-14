import { NextRequest, NextResponse } from "next/server"
import { authenticateRequest } from "@/lib/api-auth"
import { supabaseAdmin } from "@/lib/supabase-server"

const MAX_BYTES = 5 * 1024 * 1024

function extFor(mime: string): string | null {
  if (mime === "image/jpeg") return "jpg"
  if (mime === "image/png") return "png"
  if (mime === "image/webp") return "webp"
  return null
}

/** Upload a payment screenshot to the private `payment_proofs` bucket. */
export async function POST(req: NextRequest) {
  const auth = await authenticateRequest(req)
  if (!auth) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  }
  if (!supabaseAdmin) {
    return NextResponse.json({ error: "not_configured" }, { status: 503 })
  }

  let file: File | null = null
  try {
    const form = await req.formData()
    const f = form.get("file")
    if (f instanceof File) file = f
  } catch {
    return NextResponse.json({ error: "bad_request" }, { status: 400 })
  }
  if (!file) {
    return NextResponse.json({ error: "missing_file" }, { status: 400 })
  }
  if (file.size === 0 || file.size > MAX_BYTES) {
    return NextResponse.json({ error: "file_too_large" }, { status: 413 })
  }
  const ext = extFor(file.type)
  if (!ext) {
    return NextResponse.json({ error: "unsupported_type" }, { status: 415 })
  }

  const key = `${auth.user.id}/${crypto.randomUUID()}.${ext}`
  const { error } = await supabaseAdmin.storage
    .from("payment_proofs")
    .upload(key, file, { contentType: file.type, cacheControl: "3600" })

  if (error) {
    console.error("upload-proof error:", error)
    return NextResponse.json({ error: "upload_failed" }, { status: 500 })
  }

  return NextResponse.json({ key }, { status: 201 })
}
