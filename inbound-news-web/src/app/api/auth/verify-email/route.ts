import { NextRequest, NextResponse } from "next/server"
import { storeEmailVerificationToken, confirmUserEmail, getUserByEmail } from "@/lib/auth-db"
import { verifyEmailToken } from "@/lib/auth-db"
import { hashToken } from "@/lib/crypto"
import { constantTimeStringCompare } from "@/lib/crypto"

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const token = searchParams.get("token")

    if (!token) {
      return NextResponse.json({ error: "Token is required" }, { status: 400 })
    }

    const tokenHash = await hashToken(token)
    const userId = await verifyEmailToken(tokenHash)

    if (!userId) {
      return NextResponse.json(
        { error: "Invalid or expired verification token" },
        { status: 400 },
      )
    }

    await confirmUserEmail(userId)

    return NextResponse.json({ ok: true, message: "Email verified successfully" })
  } catch {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    )
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const email = body.email?.trim().toLowerCase()

    if (!email) {
      return NextResponse.json({ error: "Email is required" }, { status: 400 })
    }

    const user = await getUserByEmail(email)
    if (!user) {
      return NextResponse.json({ ok: true })
    }

    if (user.email_verified) {
      return NextResponse.json({ ok: true, message: "Email already verified" })
    }

    const token = crypto.randomUUID().replace(/-/g, "")
    const tokenHash = await hashToken(token)
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000)

    await storeEmailVerificationToken(user.id, tokenHash, expiresAt.toISOString())

    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"
    const verifyUrl = `${baseUrl}/api/auth/verify-email?token=${token}`

    console.log(`[DEV] Email verification link: ${verifyUrl}`)

    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    )
  }
}
