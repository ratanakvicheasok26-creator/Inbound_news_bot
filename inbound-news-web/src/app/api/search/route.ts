import { NextRequest, NextResponse } from "next/server"
import { supabase } from "@/lib/supabase"

export async function GET(req: NextRequest) {
  try {
    const q = req.nextUrl.searchParams.get("q")?.trim()
    if (!q || q.length < 2) {
      return NextResponse.json({ stories: [], articles: [] })
    }

    const pattern = `%${q}%`

    const [storiesRes, articlesRes] = await Promise.all([
      supabase
        .from("stories")
        .select("*")
        .or(`title.ilike.${pattern},summary_en.ilike.${pattern},tags.cs.{${q}}`)
        .order("created_at", { ascending: false })
        .limit(20),
      supabase
        .from("articles")
        .select("*")
        .or(`title.ilike.${pattern},source_name.ilike.${pattern},source_domain.ilike.${pattern}`)
        .order("published_at", { ascending: false })
        .limit(20),
    ])

    return NextResponse.json({
      stories: storiesRes.data ?? [],
      articles: articlesRes.data ?? [],
    })
  } catch (error) {
    console.error("Search API error:", error)
    return NextResponse.json({ stories: [], articles: [] }, { status: 500 })
  }
}
