import { NextRequest, NextResponse } from "next/server"
import { hashPassword } from "@/lib/crypto"
import { verifyPasswordResetToken, updatePasswordHash, revokeAllUserRefreshTokens } from "@/lib/auth-db"
import { hashToken } from "@/lib/crypto"
import { validatePassword, checkPasswordBreach } from "@/lib/password-policy"

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const token = body.token
    const newPassword = body.password

    if (!token || !newPassword) {
      return NextResponse.json(
        { error: "Token and new password are required" },
        { status: 400 },
      )
    }

    const passwordValidation = validatePassword(newPassword)
    if (!passwordValidation.valid) {
      return NextResponse.json(
        { error: passwordValidation.errors[0] },
        { status: 400 },
      )
    }

    const breachCheck = await checkPasswordBreach(newPassword)
    if (breachCheck.breached) {
      return NextResponse.json(
        {
          error: "This password has appeared in a data breach. Please choose a different password.",
        },
        { status: 400 },
      )
    }

    const tokenHash = await hashToken(token)
    const userId = await verifyPasswordResetToken(tokenHash)

    if (!userId) {
      return NextResponse.json(
        { error: "Invalid or expired reset token" },
        { status: 400 },
      )
    }

    const newHash = await hashPassword(newPassword)
    await updatePasswordHash(userId, newHash)
    await revokeAllUserRefreshTokens(userId)

    return NextResponse.json({ ok: true, message: "Password updated successfully" })
  } catch {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    )
  }
}
