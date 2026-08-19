import { NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase-route"

export async function POST(req: NextRequest) {
  try {
    const supabase = await createServerClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 })
    }

    const body = await req.json()
    const newEmail = body.new_email?.trim().toLowerCase()

    if (!newEmail) {
      return NextResponse.json({ error: "New email is required" }, { status: 400 })
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newEmail)) {
      return NextResponse.json({ error: "Invalid email format" }, { status: 400 })
    }

    if (newEmail === user.email) {
      return NextResponse.json(
        { error: "New email must be different from current email" },
        { status: 400 },
      )
    }

    const { error: updateError } = await supabase.auth.updateUser({ email: newEmail })

    if (updateError) {
      return NextResponse.json(
        { error: updateError.message || "Failed to update email" },
        { status: 400 },
      )
    }

    return NextResponse.json({
      ok: true,
      message: "Verification emails sent to both addresses",
    })
  } catch {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    )
  }
}

export async function PUT(req: NextRequest) {
  // With Supabase Auth, email confirmation is handled automatically.
  // This endpoint is no longer needed.
  return NextResponse.json({ ok: true, message: "Email confirmation handled by Supabase Auth" })
}
