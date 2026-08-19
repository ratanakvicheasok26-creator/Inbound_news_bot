import { NextRequest, NextResponse } from "next/server"
import { getAccessTokenFromCookies } from "@/lib/session"
import { verifyAccessToken } from "@/lib/crypto"
import { getUserById, getUserProfile } from "@/lib/auth-db"

export async function GET(req: NextRequest) {
  try {
    const token = getAccessTokenFromCookies(req.headers.get("cookie"))
    if (!token) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
    }

    const payload = await verifyAccessToken(token)
    if (!payload) {
      return NextResponse.json({ error: "Invalid token" }, { status: 401 })
    }

    const user = await getUserById(payload.sub)
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }

    const profile = await getUserProfile(user.id)

    return NextResponse.json({
      user: {
        id: user.id,
        email: user.email,
        email_verified: user.email_verified,
        display_name: profile?.display_name || user.email.split("@")[0],
        created_at: user.created_at,
        user_metadata: {},
      },
    })
  } catch {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    )
  }
}
