import { NextRequest, NextResponse } from "next/server"
import { supabase, isSupabaseConfigured } from "@/lib/supabase"
import { escapeOrValue } from "@/lib/posts"

const STORY_COLUMNS = "id, title, category, tags, created_at"
const ARTICLE_COLUMNS = "id, title, url, source_name, source_domain, published_at"

const LIMIT = 6

/** First token, sanitized so it is safe inside `.or()` filters. */
function firstToken(q: string): string {
  return (
    q
      .replace(/[{},"\\%_]/g, " ")
      .trim()
      .split(/\s+/)[0] || ""
  )
}

/**
 * Lightweight typeahead suggestions for the live search dropdown.
 * Works from a single character — returns a few recent matching stories
 * and articles, newest first.
 */
export async function GET(req: NextRequest) {
  try {
    if (!isSupabaseConfigured) {
      return NextResponse.json({ stories: [], articles: [] }, { status: 503 })
    }

    const q = req.nextUrl.searchParams.get("q")?.trim() ?? ""
    if (!q) return NextResponse.json({ stories: [], articles: [] })
    if (q.length > 60) return NextResponse.json({ stories: [], articles: [] })

    const term = firstToken(q)
    if (!term) return NextResponse.json({ stories: [], articles: [] })
    const escaped = escapeOrValue(`%${term}%`)

    const [storiesRes, articlesRes] = await Promise.all([
      supabase
        .from("stories")
        .select(STORY_COLUMNS)
        .or(`title.ilike.${escaped},summary_en.ilike.${escaped}`)
        .order("created_at", { ascending: false })
        .limit(LIMIT),
      supabase
        .from("articles")
        .select(ARTICLE_COLUMNS)
        .or(`title.ilike.${escaped},source_name.ilike.${escaped}`)
        .order("published_at", { ascending: false })
        .limit(LIMIT),
    ])

    if (storiesRes.error) console.error("Suggest stories:", storiesRes.error)
    if (articlesRes.error) console.error("Suggest articles:", articlesRes.error)

    return NextResponse.json({
      stories: storiesRes.data ?? [],
      articles: articlesRes.data ?? [],
    })
  } catch (error) {
    console.error("Suggest API error:", error)
    return NextResponse.json({ stories: [], articles: [] })
  }
}
