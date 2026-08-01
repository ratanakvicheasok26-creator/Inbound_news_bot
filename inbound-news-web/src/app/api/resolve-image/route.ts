import { NextRequest, NextResponse } from "next/server"
import { resolveOgImage } from "@/lib/og-image"
import { isValidImageUrl, isSafeHost } from "@/lib/story-images"

export async function GET(req: NextRequest) {
  const pageUrl = req.nextUrl.searchParams.get("url") || ""
  if (!isValidImageUrl(pageUrl) || !isSafeHost(pageUrl)) {
    return NextResponse.json({ imageUrl: null }, { status: 400 })
  }

  const imageUrl = await resolveOgImage(pageUrl)
  return NextResponse.json(
    { imageUrl: imageUrl && isSafeHost(imageUrl) ? imageUrl : null },
    {
      headers: {
        "Cache-Control": "public, s-maxage=86400, stale-while-revalidate=604800",
      },
    }
  )
}
