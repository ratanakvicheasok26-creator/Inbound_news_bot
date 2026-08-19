import { NextRequest, NextResponse } from "next/server"
import { verifyEmailChangeNonce, cancelPendingEmailChange } from "@/lib/auth-db"
import { hashToken } from "@/lib/crypto"

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const token = searchParams.get("token")

    if (!token) {
      return NextResponse.json({ error: "Token is required" }, { status: 400 })
    }

    const tokenHash = await hashToken(token)
    const result = await verifyEmailChangeNonce(tokenHash, "old_email_revoke")

    if (!result) {
      return NextResponse.json(
        { error: "Invalid or expired cancellation token" },
        { status: 400 },
      )
    }

    await cancelPendingEmailChange(result.userId)

    return NextResponse.json({
      ok: true,
      message: "Email change has been cancelled. Your account is secure.",
    })
  } catch {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    )
  }
}
