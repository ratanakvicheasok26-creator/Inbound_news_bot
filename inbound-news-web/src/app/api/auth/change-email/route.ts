import { NextRequest, NextResponse } from "next/server"
import { getAccessTokenFromCookies } from "@/lib/session"
import { verifyAccessToken } from "@/lib/crypto"
import {
  storeEmailChangeNonce,
  verifyEmailChangeNonce,
  updateUserEmail,
  cancelPendingEmailChange,
  getUserById,
} from "@/lib/auth-db"
import { hashToken } from "@/lib/crypto"
import { validateEmail } from "@/lib/password-policy"

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
    const newEmail = body.new_email?.trim().toLowerCase()

    if (!newEmail) {
      return NextResponse.json({ error: "New email is required" }, { status: 400 })
    }

    if (!validateEmail(newEmail)) {
      return NextResponse.json({ error: "Invalid email format" }, { status: 400 })
    }

    if (newEmail === payload.email) {
      return NextResponse.json(
        { error: "New email must be different from current email" },
        { status: 400 },
      )
    }

    await cancelPendingEmailChange(payload.sub)

    const expiryMs = 60 * 60 * 1000
    const expiresAt = new Date(Date.now() + expiryMs)

    const oldNonceToken = crypto.randomUUID().replace(/-/g, "")
    const oldNonceHash = await hashToken(oldNonceToken)
    await storeEmailChangeNonce(
      payload.sub,
      "old_email_revoke",
      newEmail,
      oldNonceHash,
      expiresAt.toISOString(),
    )

    const newNonceToken = crypto.randomUUID().replace(/-/g, "")
    const newNonceHash = await hashToken(newNonceToken)
    await storeEmailChangeNonce(
      payload.sub,
      "new_email_verify",
      newEmail,
      newNonceHash,
      expiresAt.toISOString(),
    )

    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"
    const cancelUrl = `${baseUrl}/api/auth/cancel-email-change?token=${oldNonceToken}`
    const confirmUrl = `${baseUrl}/api/auth/change-email?token=${newNonceToken}`

    console.log(`[DEV] Security alert (cancel) link: ${cancelUrl}`)
    console.log(`[DEV] New email verification link: ${confirmUrl}`)

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
  try {
    const { searchParams } = new URL(req.url)
    const token = searchParams.get("token")

    if (!token) {
      return NextResponse.json({ error: "Token is required" }, { status: 400 })
    }

    const tokenHash = await hashToken(token)
    const result = await verifyEmailChangeNonce(tokenHash, "new_email_verify")

    if (!result) {
      return NextResponse.json(
        { error: "Invalid or expired email change token" },
        { status: 400 },
      )
    }

    await updateUserEmail(result.userId, result.newEmail)

    return NextResponse.json({ ok: true, message: "Email updated successfully" })
  } catch {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    )
  }
}
