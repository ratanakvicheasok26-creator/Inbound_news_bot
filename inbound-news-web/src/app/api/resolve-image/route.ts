import { NextRequest, NextResponse } from "next/server"
import { resolveOgImage } from "@/lib/og-image"
import { isValidImageUrl } from "@/lib/story-images"

export async function GET(req: NextRequest) {
  const pageUrl = req.nextUrl.searchParams.get("url") || ""
  if (!isValidImageUrl(pageUrl)) {
    return NextResponse.json({ imageUrl: null }, { status: 400 })
  }

  const imageUrl = await resolveOgImage(pageUrl)
  return NextResponse.json(
    { imageUrl },
    {
      headers: {
        "Cache-Control": "public, s-maxage=86400, stale-while-revalidate=604800",
      },
    }
  )
}
