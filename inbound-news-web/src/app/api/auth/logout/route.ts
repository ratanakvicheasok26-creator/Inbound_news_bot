import { NextRequest, NextResponse } from "next/server"
import { getRefreshTokenFromCookies, clearSessionCookies } from "@/lib/session"
import { verifyRefreshToken, revokeRefreshToken } from "@/lib/auth-db"
import { verifyRefreshToken as verifyJWTRefresh, hashToken } from "@/lib/crypto"

export async function POST(req: NextRequest) {
  try {
    const refreshTokenValue = getRefreshTokenFromCookies(req.headers.get("cookie"))

    if (refreshTokenValue) {
      const tokenData = await verifyJWTRefresh(refreshTokenValue)
      if (tokenData) {
        const hashed = await hashToken(refreshTokenValue)
        const stored = await verifyRefreshToken(hashed)
        if (stored) {
          await revokeRefreshToken(stored.id)
        }
      }
    }

    const response = NextResponse.json({ ok: true })

    const cookies = clearSessionCookies()
    for (const cookie of cookies) {
      response.headers.append("Set-Cookie", cookie)
    }

    return response
  } catch {
    const response = NextResponse.json({ ok: true })
    const cookies = clearSessionCookies()
    for (const cookie of cookies) {
      response.headers.append("Set-Cookie", cookie)
    }
    return response
  }
}
