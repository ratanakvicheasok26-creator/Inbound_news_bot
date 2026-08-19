import { NextRequest, NextResponse } from "next/server"
import { getUserByEmail, storePasswordResetToken } from "@/lib/auth-db"
import { hashToken } from "@/lib/crypto"

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

    const token = crypto.randomUUID().replace(/-/g, "")
    const tokenHash = await hashToken(token)
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000)

    await storePasswordResetToken(user.id, tokenHash, expiresAt.toISOString())

    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"
    const resetUrl = `${baseUrl}/reset-password?token=${token}`

    console.log(`[DEV] Password reset link: ${resetUrl}`)

    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    )
  }
}
