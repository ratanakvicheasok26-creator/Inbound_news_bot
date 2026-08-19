import { NextRequest, NextResponse } from "next/server"
import { getRefreshTokenFromCookies, setSessionCookies } from "@/lib/session"
import { verifyRefreshToken, storeRefreshToken, revokeRefreshToken, getUserById } from "@/lib/auth-db"
import { signAccessToken, signRefreshToken, hashToken, verifyRefreshToken as verifyJWTRefresh } from "@/lib/crypto"

export async function POST(req: NextRequest) {
  try {
    const refreshTokenValue = getRefreshTokenFromCookies(req.headers.get("cookie"))
    if (!refreshTokenValue) {
      return NextResponse.json({ error: "No refresh token" }, { status: 401 })
    }

    const tokenData = await verifyJWTRefresh(refreshTokenValue)
    if (!tokenData) {
      return NextResponse.json({ error: "Invalid refresh token" }, { status: 401 })
    }

    const hashedToken = await hashToken(refreshTokenValue)
    const storedToken = await verifyRefreshToken(hashedToken)
    if (!storedToken) {
      return NextResponse.json({ error: "Refresh token revoked or expired" }, { status: 401 })
    }

    const user = await getUserById(storedToken.userId)
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 401 })
    }

    await revokeRefreshToken(storedToken.id)

    const newAccessToken = await signAccessToken({
      sub: user.id,
      email: user.email,
      email_verified: user.email_verified,
    })

    const newRefreshToken = await signRefreshToken(user.id)
    const newRefreshTokenHash = await hashToken(newRefreshToken)
    const refreshExpiry = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
    await storeRefreshToken(user.id, newRefreshTokenHash, refreshExpiry.toISOString())

    const response = NextResponse.json({
      access_token: newAccessToken,
    })

    const cookies = setSessionCookies(newAccessToken, newRefreshToken)
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
