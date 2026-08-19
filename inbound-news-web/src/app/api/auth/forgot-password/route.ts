import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ""
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ""

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const email = body.email?.trim().toLowerCase()

    if (!email) {
      return NextResponse.json({ error: "Email is required" }, { status: 400 })
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey)

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"}/auth/callback?next=/reset-password`,
    })

    // Always return success to prevent email enumeration
    if (error) {
      console.error("[Auth] resetPasswordForEmail error:", error.message)
    }

    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    )
  }
}
