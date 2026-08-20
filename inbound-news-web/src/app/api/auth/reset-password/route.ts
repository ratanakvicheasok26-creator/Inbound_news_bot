import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { createServerClient } from "@/lib/supabase-route"
import { validatePassword } from "@/lib/password-policy"

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ""
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ""

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const newPassword = body.password
    const accessToken = body.access_token as string | undefined

    if (!newPassword) {
      return NextResponse.json(
        { error: "New password is required" },
        { status: 400 },
      )
    }

    const passwordCheck = validatePassword(newPassword)
    if (!passwordCheck.valid) {
      return NextResponse.json(
        { error: passwordCheck.errors[0] || "Invalid password" },
        { status: 400 },
      )
    }

    let supabase = await createServerClient()
    let user = (await supabase.auth.getUser()).data.user

    if (!user && accessToken) {
      const tokenClient = createClient(supabaseUrl, supabaseAnonKey, {
        auth: { autoRefreshToken: false, persistSession: false },
        global: { headers: { Authorization: `Bearer ${accessToken}` } },
      })
      const { data: tokenUser, error: tokenError } = await tokenClient.auth.getUser()
      if (tokenError || !tokenUser.user) {
        return NextResponse.json(
          { error: "Invalid or expired reset link" },
          { status: 400 },
        )
      }
      supabase = tokenClient
      user = tokenUser.user
    }

    if (!user) {
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
