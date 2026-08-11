import { NextRequest, NextResponse } from "next/server"
import { resolveOgImage } from "@/lib/og-image"
import { isValidImageUrl, isSafeHost, assertPublicUrl } from "@/lib/story-images"
import { getClientIp, rateLimit } from "@/lib/rate-limit"

export async function GET(req: NextRequest) {
  const limit = rateLimit(`resolve-image:${getClientIp(req)}`, 30, 60_000)
  if (!limit.ok) {
    return NextResponse.json(
      { imageUrl: null, error: "Too many requests" },
      { status: 429, headers: { "Retry-After": String(limit.retryAfter) } }
    )
  }

  const pageUrl = req.nextUrl.searchParams.get("url") || ""
  if (!isValidImageUrl(pageUrl) || !isSafeHost(pageUrl)) {
    return NextResponse.json({ imageUrl: null }, { status: 400 })
  }
  if (!(await assertPublicUrl(pageUrl))) {
    return NextResponse.json({ imageUrl: null }, { status: 400 })
  }

  const imageUrl = await resolveOgImage(pageUrl)
  const safe =
    imageUrl && isSafeHost(imageUrl) && (await assertPublicUrl(imageUrl))
      ? imageUrl
      : null
  return NextResponse.json(
    { imageUrl: safe },
    {
      headers: {
        "Cache-Control": "public, s-maxage=86400, stale-while-revalidate=604800",
      },
    }
  )
}
