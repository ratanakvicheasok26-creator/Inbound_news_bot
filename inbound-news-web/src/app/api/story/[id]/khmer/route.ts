import { NextRequest, NextResponse } from "next/server"
import { authenticateRequest, getMembershipForUser } from "@/lib/api-auth"
import { effectiveTier } from "@/lib/access"
import { createUserClient } from "@/lib/supabase-server"
import { buildKhmerContent, allowedLevel, canUseFreeTranslation, canUsePaidTranslation } from "@/lib/khmer-content"

const STORY_COLUMNS = "id, title, summary_en, source_count, category, tags, created_at, image_url, premium"
const ARTICLE_COLUMNS =
  "id, title, summary, url, source_name, source_domain, category, language, published_at, ingested_at, image_url, raw_json"

type Params = { params: Promise<{ id: string }> }

/**
 * Khmer AI content for a story.
 *
 *   Free    → basic Khmer summary (daily cap enforced) — `basic_khmer_translation`
 *   Member  → full Khmer Decode of every source         — `khmer_decode`
 *
 * The Khmer interface itself is free; this endpoint only gates AI-generated
 * Khmer content. Translations are cached in `article_translations` and reused.
 */
export async function POST(req: NextRequest, { params }: Params) {
  try {
    const { id } = await params

    const auth = await authenticateRequest(req)
    if (!auth) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 })
    }

    const membership = await getMembershipForUser(auth)
    const tier = effectiveTier(membership)
    const level = allowedLevel(tier)

    if (level === "full") {
      if (!canUsePaidTranslation(auth.user.id)) {
        return NextResponse.json(
          { error: "rate_limited" },
          { status: 429, headers: { "Retry-After": "3600" } }
        )
      }
    } else if (!canUseFreeTranslation(auth.user.id)) {
      return NextResponse.json(
        { error: "rate_limited" },
        { status: 429, headers: { "Retry-After": "3600" } }
      )
    }

    const supabase = createUserClient(`Bearer ${auth.token}`)

    const { data: story, error: storyError } = await supabase
      .from("stories")
      .select(STORY_COLUMNS)
      .eq("id", id)
      .single()

    if (storyError || !story) {
      return NextResponse.json({ error: "not_found" }, { status: 404 })
    }

    const { data: links } = await supabase
      .from("story_sources")
      .select("article_id")
      .eq("story_id", id)
      .limit(40)

    const articleIds = (links || []).map((l) => l.article_id).filter(Boolean)
    const articleList: { id: string; title: string; summary: string | null; source_name: string | null }[] = []
    if (articleIds.length > 0) {
      const { data: articleData } = await supabase
        .from("articles")
        .select(ARTICLE_COLUMNS)
        .in("id", articleIds)
        .order("published_at", { ascending: false })
        .limit(40)
      for (const a of articleData || []) {
        articleList.push({
          id: a.id,
          title: a.title,
          summary: a.summary,
          source_name: a.source_name,
        })
      }
    }

    const content = await buildKhmerContent({
      supabase,
      user: auth.user,
      tier,
      story: { id: story.id, title: story.title, summary_en: story.summary_en },
      articles: articleList,
    })

    return NextResponse.json({ content })
  } catch (err) {
    console.error("Khmer content API error:", err)
    return NextResponse.json({ error: "khmer_unavailable" }, { status: 500 })
  }
}
