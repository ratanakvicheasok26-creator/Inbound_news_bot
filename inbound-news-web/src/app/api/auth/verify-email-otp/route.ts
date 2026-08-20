import { NextRequest, NextResponse } from "next/server"
import { supabaseAdmin } from "@/lib/supabase-server"
import { verifyStoredOtp } from "@/lib/otp"

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const email = body.email?.trim().toLowerCase()
    const token = body.token?.trim()

    if (!email || !token) {
      return NextResponse.json(
        { error: "Email and verification code are required" },
        { status: 400 },
      )
    }

    if (!supabaseAdmin) {
      return NextResponse.json(
        { error: "Authentication service unavailable" },
        { status: 503 },
      )
    }

    const result = await verifyStoredOtp(email, token)

    if (!result.valid) {
      return NextResponse.json(
        { error: result.error || "Invalid verification code" },
        { status: 400 },
      )
    }

    const { error: confirmError } = await supabaseAdmin.auth.admin.updateUserById(
      result.userId!,
      { email_confirm: true },
    )

    if (confirmError) {
      console.error("[Auth] verify-email-otp confirm error:", confirmError.message)
      return NextResponse.json(
        { error: "Failed to confirm email. Please try again." },
        { status: 500 },
      )
    }

    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    )
  }
}
