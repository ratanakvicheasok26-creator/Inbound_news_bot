import { NextRequest, NextResponse } from "next/server"
import { supabaseAdmin } from "@/lib/supabase-server"
import { sendPasswordResetEmail } from "@/lib/email"

function siteUrl(): string {
  return process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"
}

function recoveryRedirectTo(): string {
  return `${siteUrl()}/auth/callback?next=/reset-password`
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const email = body.email?.trim().toLowerCase()

    if (!email) {
      return NextResponse.json({ error: "Email is required" }, { status: 400 })
    }

    if (!supabaseAdmin) {
      console.error("[Auth] forgot-password: Supabase admin not configured")
      return NextResponse.json({ ok: true })
    }

    const { data, error } = await supabaseAdmin.auth.admin.generateLink({
      type: "recovery",
      email,
      options: { redirectTo: recoveryRedirectTo() },
    })

    if (error) {
      console.error("[Auth] generateLink recovery error:", error.message)
      return NextResponse.json({ ok: true })
    }

    const resetUrl = data.properties.action_link
    if (resetUrl) {
      const sendResult = await sendPasswordResetEmail(email, resetUrl)
      if (!sendResult.ok) {
        console.error("[Auth] sendPasswordResetEmail failed:", sendResult.error)
      }
    }

    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    )
  }
}
