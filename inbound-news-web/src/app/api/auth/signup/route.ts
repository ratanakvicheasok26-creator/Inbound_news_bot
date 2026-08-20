import { NextRequest, NextResponse } from "next/server"
import { supabaseAdmin } from "@/lib/supabase-server"
import { findUserByEmail } from "@/lib/auth-admin"
import { sendOtpEmail } from "@/lib/email"
import { validatePassword } from "@/lib/password-policy"
import { generateOtp, storeOtp } from "@/lib/otp"

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const email = body.email?.trim().toLowerCase()
    const password = body.password
    const displayName = (body.display_name?.trim() || email?.split("@")[0] || "") as string

    if (!email || !password) {
      return NextResponse.json(
        { error: "Email and password are required" },
        { status: 400 },
      )
    }

    const passwordCheck = validatePassword(password)
    if (!passwordCheck.valid) {
      return NextResponse.json(
        { error: passwordCheck.errors[0] || "Invalid password" },
        { status: 400 },
      )
    }

    if (!supabaseAdmin) {
      return NextResponse.json(
        { error: "Authentication service unavailable" },
        { status: 503 },
      )
    }

    const existingUser = await findUserByEmail(email)

    if (existingUser) {
      if (existingUser.email_confirmed_at) {
        return NextResponse.json(
          { error: "An account with this email already exists" },
          { status: 400 },
        )
      }

      await supabaseAdmin.auth.admin.updateUserById(existingUser.id, {
        password,
        user_metadata: {
          ...existingUser.user_metadata,
          display_name: displayName,
        },
      })

      const otp = generateOtp()
      const stored = await storeOtp(existingUser.id, email, otp)
      if (!stored) {
        return NextResponse.json(
          { error: "Failed to create verification code. Please try again." },
          { status: 500 },
        )
      }

      const sent = await sendOtpEmail(email, otp, displayName)
      if (!sent.ok) {
        console.error("[Auth] Resend email warning for existing user:", sent.error)
      }

      return NextResponse.json({
        status: "verification_resent",
        user: {
          id: existingUser.id,
          email,
          email_verified: false,
          display_name: displayName,
        },
      })
    }

    const { data: created, error: createError } =
      await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: false,
        user_metadata: { display_name: displayName },
      })

    if (createError || !created.user) {
      const msg = createError?.message || "Signup failed"
      if (msg.includes("already") || msg.includes("registered")) {
        return NextResponse.json(
          { error: "An account with this email already exists" },
          { status: 400 },
        )
      }
      console.error("[Auth] createUser error:", msg)
      return NextResponse.json({ error: msg }, { status: 400 })
    }

    const otp = generateOtp()
    const stored = await storeOtp(created.user.id, email, otp)
    if (!stored) {
      return NextResponse.json(
        { error: "Account created but verification code failed. Please use resend." },
        { status: 500 },
      )
    }

    const sent = await sendOtpEmail(email, otp, displayName)
    if (!sent.ok) {
      console.error("[Auth] Resend email warning for new user:", sent.error)
    }

    return NextResponse.json(
      {
        status: "created",
        user: {
          id: created.user.id,
          email,
          email_verified: false,
          display_name: displayName,
        },
      },
      { status: 201 },
    )
  } catch {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    )
  }
}
