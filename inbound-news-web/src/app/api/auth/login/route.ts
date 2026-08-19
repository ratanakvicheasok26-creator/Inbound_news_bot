import { NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase-route"

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const email = body.email?.trim().toLowerCase()
    const password = body.password

    if (!email || !password) {
      return NextResponse.json(
        { error: "Email and password are required" },
        { status: 400 },
      )
    }

    const supabase = await createServerClient()

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (error) {
      return NextResponse.json(
        { error: error.message || "Invalid email or password" },
        { status: 401 },
      )
    }

    if (!data.user) {
      return NextResponse.json(
        { error: "Login failed" },
        { status: 401 },
      )
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("display_name")
      .eq("id", data.user.id)
      .maybeSingle()

    return NextResponse.json({
      user: {
        id: data.user.id,
        email: data.user.email,
        email_verified: !!data.user.email_confirmed_at,
        display_name:
          (data.user.user_metadata?.display_name as string) ||
          profile?.display_name ||
          email.split("@")[0],
        created_at: data.user.created_at,
      },
    })
  } catch {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    )
  }
}
