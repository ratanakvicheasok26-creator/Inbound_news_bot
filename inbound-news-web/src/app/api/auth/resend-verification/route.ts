import { NextRequest, NextResponse } from "next/server"
import { supabaseAdmin } from "@/lib/supabase-server"
import { findUserByEmail } from "@/lib/auth-admin"
import { sendOtpEmail } from "@/lib/email"
import { generateOtp, storeOtp } from "@/lib/otp"

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const email = body.email?.trim().toLowerCase()

    if (!email) {
      return NextResponse.json({ error: "Email is required" }, { status: 400 })
    }

    if (!supabaseAdmin) {
      return NextResponse.json({ ok: true })
    }

    const existing = await findUserByEmail(email)

    if (!existing) {
      return NextResponse.json({ ok: true })
    }

    if (existing.email_confirmed_at) {
      return NextResponse.json({ ok: true })
    }

    const displayName =
      (existing.user_metadata?.display_name as string) ||
      email.split("@")[0]

    const otp = generateOtp()
    const stored = await storeOtp(existing.id, email, otp)
    if (!stored) {
      return NextResponse.json(
        { error: "Failed to create verification code. Please try again." },
        { status: 500 },
      )
    }

    const sendResult = await sendOtpEmail(email, otp, displayName)

    if (!sendResult.ok) {
      console.error("[Auth] resend-verification send failed, trying Supabase fallback:", sendResult.error)
      await supabaseAdmin.auth.resend({ type: "signup", email }).catch((err) => {
        console.error("[Auth] Supabase fallback resend email error:", err)
      })
    }

    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    )
  }
}
