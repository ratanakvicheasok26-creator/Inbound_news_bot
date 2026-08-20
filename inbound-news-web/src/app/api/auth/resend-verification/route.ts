import { NextRequest, NextResponse } from "next/server"
import { supabaseAdmin } from "@/lib/supabase-server"
import { findUserByEmail } from "@/lib/auth-admin"
import { sendVerificationEmail } from "@/lib/email"

function siteUrl(): string {
  return process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"
}

function verifyRedirectTo(): string {
  return `${siteUrl()}/auth/callback?next=/auth/confirm`
}

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

    const { data: linkData, error: linkError } =
      await supabaseAdmin.auth.admin.generateLink({
        type: "magiclink",
        email,
        options: { redirectTo: verifyRedirectTo() },
      })

    if (linkError || !linkData.properties.action_link) {
      console.error("[Auth] resend-verification generateLink error:", linkError?.message)
      return NextResponse.json({ ok: true })
    }

    const sendResult = await sendVerificationEmail(
      email,
      linkData.properties.action_link,
      displayName,
    )

    if (!sendResult.ok) {
      console.error("[Auth] resend-verification send failed:", sendResult.error)
    }

    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    )
  }
}
