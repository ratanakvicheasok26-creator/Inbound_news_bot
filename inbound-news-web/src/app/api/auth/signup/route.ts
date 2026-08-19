import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ""
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ""

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const email = body.email?.trim().toLowerCase()
    const password = body.password
    const displayName = body.display_name?.trim()

    if (!email || !password) {
      return NextResponse.json(
        { error: "Email and password are required" },
        { status: 400 },
      )
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey)

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          display_name: displayName || "",
        },
      },
    })

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 400 },
      )
    }

    if (!data.user) {
      return NextResponse.json(
        { error: "Signup failed" },
        { status: 400 },
      )
    }

    return NextResponse.json({
      user: {
        id: data.user.id,
        email: data.user.email,
        email_verified: !!data.user.email_confirmed_at,
        display_name: displayName || email.split("@")[0],
      },
      access_token: data.session?.access_token || null,
    }, { status: 201 })
  } catch {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    )
  }
}
