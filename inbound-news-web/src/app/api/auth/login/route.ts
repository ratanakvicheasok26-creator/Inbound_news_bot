import { NextRequest, NextResponse } from "next/server"
import { hashPassword, verifyPassword } from "@/lib/crypto"
import {
  getUserByEmail,
  getPasswordHash,
  storeRefreshToken,
  getUserProfile,
} from "@/lib/auth-db"
import { signAccessToken, signRefreshToken, hashToken } from "@/lib/crypto"
import { setSessionCookies } from "@/lib/session"
import {
  checkLoginRateLimit,
  recordFailedLogin,
  clearLoginAttempts,
  getBackoffDelay,
} from "@/lib/rate-limit-enhanced"

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

    const clientIp =
      req.headers.get("x-vercel-forwarded-for")?.split(",")[0]?.trim() ||
      req.headers.get("x-real-ip") ||
      req.headers.get("cf-connecting-ip") ||
      "unknown"

    const rateLimitResult = checkLoginRateLimit(email, clientIp)
    if (!rateLimitResult.allowed) {
      return NextResponse.json(
        {
          error: "Too many login attempts. Please try again later.",
          retryAfterMs: rateLimitResult.retryAfterMs,
        },
        {
          status: 429,
          headers: {
            "Retry-After": String(Math.ceil(rateLimitResult.retryAfterMs / 1000)),
          },
        },
      )
    }

    const user = await getUserByEmail(email)
    if (!user) {
      const attemptIdx = recordFailedLogin(email, clientIp)
      const backoffMs = getBackoffDelay(attemptIdx)
      await new Promise((resolve) => setTimeout(resolve, backoffMs))
      return NextResponse.json(
        { error: "Invalid email or password" },
        { status: 401 },
      )
    }

    const storedHash = await getPasswordHash(user.id)
    if (!storedHash) {
      return NextResponse.json(
        { error: "Invalid email or password" },
        { status: 401 },
      )
    }

    const passwordValid = await verifyPassword(password, storedHash)
    if (!passwordValid) {
      const attemptIdx = recordFailedLogin(email, clientIp)
      const backoffMs = getBackoffDelay(attemptIdx)
      await new Promise((resolve) => setTimeout(resolve, backoffMs))
      return NextResponse.json(
        { error: "Invalid email or password" },
        { status: 401 },
      )
    }

    clearLoginAttempts(email)

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
        display_name: profile?.display_name || email.split("@")[0],
        created_at: new Date().toISOString(),
      },
      access_token: accessToken,
    })

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
