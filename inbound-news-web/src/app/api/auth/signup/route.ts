import { NextRequest, NextResponse } from "next/server"
import { hashPassword } from "@/lib/crypto"
import { createUser, getUserByEmail, storeRefreshToken, getUserProfile } from "@/lib/auth-db"
import { signAccessToken, signRefreshToken, hashToken } from "@/lib/crypto"
import { setSessionCookies } from "@/lib/session"
import { validatePassword, validateEmail, checkPasswordBreach } from "@/lib/password-policy"

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

    if (!validateEmail(email)) {
      return NextResponse.json(
        { error: "Invalid email format" },
        { status: 400 },
      )
    }

    const passwordValidation = validatePassword(password)
    if (!passwordValidation.valid) {
      return NextResponse.json(
        {
          error: passwordValidation.errors[0],
          score: passwordValidation.score,
          feedback: passwordValidation.feedback,
        },
        { status: 400 },
      )
    }

    const breachCheck = await checkPasswordBreach(password)
    if (breachCheck.breached) {
      return NextResponse.json(
        {
          error: "This password has appeared in a data breach. Please choose a different password.",
          breachCount: breachCheck.count,
        },
        { status: 400 },
      )
    }

    const existingUser = await getUserByEmail(email)
    if (existingUser) {
      return NextResponse.json(
        { error: "An account with this email already exists" },
        { status: 409 },
      )
    }

    const passwordHash = await hashPassword(password)
    const user = await createUser(email, passwordHash, displayName)

    const accessToken = await signAccessToken({
      sub: user.id,
      email: user.email,
      email_verified: user.email_verified,
    })

    const refreshToken = await signRefreshToken(user.id)
    const refreshTokenHash = await hashToken(refreshToken)
    const refreshExpiry = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
    await storeRefreshToken(user.id, refreshTokenHash, refreshExpiry.toISOString())

    const profile = await getUserProfile(user.id)

    const response = NextResponse.json({
      user: {
        id: user.id,
        email: user.email,
        email_verified: user.email_verified,
        display_name: profile?.display_name || displayName || email.split("@")[0],
      },
      access_token: accessToken,
    }, { status: 201 })

    const cookies = setSessionCookies(accessToken, refreshToken)
    for (const cookie of cookies) {
      response.headers.append("Set-Cookie", cookie)
    }

    return response
  } catch {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    )
  }
}
