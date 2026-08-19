import { NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase-route"

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const newPassword = body.password

    if (!newPassword) {
      return NextResponse.json(
        { error: "New password is required" },
        { status: 400 },
      )
    }

    if (newPassword.length < 15) {
      return NextResponse.json(
        { error: "Password must be at least 15 characters" },
        { status: 400 },
      )
    }

    const supabase = await createServerClient()

    // The user must have a valid session from the recovery link callback
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json(
        { error: "Invalid or expired reset link" },
        { status: 400 },
      )
    }

    const { error: updateError } = await supabase.auth.updateUser({
      password: newPassword,
    })

    if (updateError) {
      return NextResponse.json(
        { error: updateError.message || "Failed to update password" },
        { status: 400 },
      )
    }

    return NextResponse.json({ ok: true, message: "Password updated successfully" })
  } catch {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    )
  }
}
