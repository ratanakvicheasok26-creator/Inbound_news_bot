import { NextRequest, NextResponse } from "next/server"
import { authenticateRequest, getMembershipForUser } from "@/lib/api-auth"
import { canAccessTier, effectiveTier } from "@/lib/access"
import { createUserClient } from "@/lib/supabase-server"
import { resolveStoryBody } from "@/lib/story-body"
import type { Article } from "@/lib/types"

const STORY_COLUMNS = "id, title, summary_en, source_count, category, tags, created_at, image_url, premium"
const ARTICLE_COLUMNS =
  "id, title, summary, url, source_name, source_domain, category, language, published_at, ingested_at, image_url, raw_json"

type Params = { params: Promise<{ id: string }> }

/** Full gated story body + articles — Full Decode is a member feature (JWT via Authorization). */
export async function GET(req: NextRequest, { params }: Params) {
  const { id } = await params

  const auth = await authenticateRequest(req)
  if (!auth) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  }

  const membership = await getMembershipForUser(auth)
  if (!canAccessTier(effectiveTier(membership), "full_decode")) {
    return NextResponse.json({ error: "membership_required" }, { status: 403 })
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
  let articles: Article[] = []
  if (articleIds.length > 0) {
    const { data: articleData } = await supabase
      .from("articles")
      .select(ARTICLE_COLUMNS)
      .in("id", articleIds)
      .order("published_at", { ascending: false })
      .limit(40)
    articles = (articleData || []) as Article[]
  }

  const fullStory = { ...story, articles }
  const body = resolveStoryBody(fullStory)

  return NextResponse.json({
    body,
    articles: articles.map((a) => ({
      id: a.id,
      title: a.title,
      summary: a.summary,
      url: a.url,
      source_name: a.source_name,
      source_domain: a.source_domain,
      category: a.category,
      language: a.language,
      published_at: a.published_at,
    })),
  })
}
