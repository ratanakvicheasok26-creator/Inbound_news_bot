import { NextRequest, NextResponse } from "next/server"
import { getAccessTokenFromCookies } from "@/lib/session"
import { verifyAccessToken, hashPassword } from "@/lib/crypto"
import { getPasswordHash, updatePasswordHash, revokeAllUserRefreshTokens } from "@/lib/auth-db"
import { verifyPassword } from "@/lib/crypto"
import { validatePassword, checkPasswordBreach } from "@/lib/password-policy"

export async function POST(req: NextRequest) {
  try {
    const token = getAccessTokenFromCookies(req.headers.get("cookie"))
    if (!token) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 })
    }

    const payload = await verifyAccessToken(token)
    if (!payload) {
      return NextResponse.json({ error: "Invalid token" }, { status: 401 })
    }

    const body = await req.json()
    const { current_password, new_password } = body

    if (!current_password || !new_password) {
      return NextResponse.json(
        { error: "Current and new passwords are required" },
        { status: 400 },
      )
    }

    const passwordValidation = validatePassword(new_password)
    if (!passwordValidation.valid) {
      return NextResponse.json(
        { error: passwordValidation.errors[0] },
        { status: 400 },
      )
    }

    const breachCheck = await checkPasswordBreach(new_password)
    if (breachCheck.breached) {
      return NextResponse.json(
        {
          error: "This password has appeared in a data breach. Please choose a different password.",
        },
        { status: 400 },
      )
    }

    const storedHash = await getPasswordHash(payload.sub)
    if (!storedHash) {
      return NextResponse.json(
        { error: "No password set for this account" },
        { status: 400 },
      )
    }

    const currentValid = await verifyPassword(current_password, storedHash)
    if (!currentValid) {
      return NextResponse.json(
        { error: "Current password is incorrect" },
        { status: 401 },
      )
    }

    const newHash = await hashPassword(new_password)
    await updatePasswordHash(payload.sub, newHash)
    await revokeAllUserRefreshTokens(payload.sub)

    return NextResponse.json({ ok: true, message: "Password updated successfully" })
  } catch {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    )
  }
}
