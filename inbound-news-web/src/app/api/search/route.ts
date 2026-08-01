import { NextRequest, NextResponse } from "next/server"
import { supabase, isSupabaseConfigured } from "@/lib/supabase"
import { escapeOrValue } from "@/lib/posts"

export async function GET(req: NextRequest) {
  try {
    if (!isSupabaseConfigured) {
      return NextResponse.json(
        { stories: [], articles: [], error: "Search is unavailable" },
        { status: 503 },
      )
    }

    const q = req.nextUrl.searchParams.get("q")?.trim()
    if (!q || q.length < 2) {
      return NextResponse.json({ stories: [], articles: [] })
    }
    if (q.length > 100) {
      return NextResponse.json(
        { stories: [], articles: [], error: "Search query too long" },
        { status: 400 },
      )
    }

    const escaped = escapeOrValue(`%${q}%`)

    const [storiesRes, articlesRes] = await Promise.all([
      supabase
        .from("stories")
        .select("id, title, summary_en, category, tags, created_at, image_url")
        .or(`title.ilike.${escaped},summary_en.ilike.${escaped}`)
        .order("created_at", { ascending: false })
        .limit(20),
      supabase
        .from("articles")
        .select("id, title, summary, url, source_name, source_domain, published_at, image_url")
        .or(`title.ilike.${escaped},source_name.ilike.${escaped},source_domain.ilike.${escaped}`)
        .order("published_at", { ascending: false })
        .limit(20),
    ])

    if (storiesRes.error) console.error("Search stories:", storiesRes.error)
    if (articlesRes.error) console.error("Search articles:", articlesRes.error)

    return NextResponse.json({
      stories: storiesRes.data ?? [],
      articles: articlesRes.data ?? [],
      error: storiesRes.error?.message || articlesRes.error?.message || null,
    })
  } catch (error) {
    console.error("Search API error:", error)
    return NextResponse.json({ stories: [], articles: [], error: "Search failed" }, { status: 500 })
  }
}
