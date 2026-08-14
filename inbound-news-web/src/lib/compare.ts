import { supabase, isSupabaseConfigured } from "./supabase"
import { isUsefulSummary, summaryFromArticleRaw } from "./story-body"
import type { Article } from "./types"
import {
  getMockArticlesForCompare,
  getMockStoryById,
  findMockStoryByArticleId,
  isMockStoriesEnabled,
} from "./mock-stories"

/**
 * News Comparison data helpers.
 *
 * Comparisons pair two articles. "Related" articles are the other articles
 * clustered into the same story (via `story_sources`) — i.e. different
 * sources covering the same event. No new tables are needed: everything is
 * derived from the existing `articles` + `story_sources` schema.
 */

/** Explicit column list — never select `embedding` for public payloads. */
export const COMPARE_ARTICLE_COLUMNS =
  "id, title, summary, url, source_name, source_domain, category, language, published_at, ingested_at, image_url"

export type CompareOption = {
  id: string
  title: string
  summary: string | null
  url: string
  source_name: string | null
  source_domain: string | null
  category: string | null
  published_at: string | null
  image_url: string | null
  storyId: string | null
  storyTitle: string | null
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function isUuid(value: string): boolean {
  return UUID_RE.test(value)
}

/** Best readable summary for an article (falls back to HN/Lobsters raw payload). */
export function articleBestSummary(article: Article): string | null {
  if (article.summary && isUsefulSummary(article.summary)) return article.summary
  const rebuilt = summaryFromArticleRaw(article)
  if (rebuilt && isUsefulSummary(rebuilt)) return rebuilt
  return null
}

function toOption(
  article: Article,
  storyId?: string | null,
  storyTitle?: string | null,
): CompareOption {
  return {
    id: article.id,
    title: article.title,
    summary: articleBestSummary(article),
    url: article.url,
    source_name: article.source_name ?? null,
    source_domain: article.source_domain ?? null,
    category: article.category ?? null,
    published_at: article.published_at ?? null,
    image_url: article.image_url ?? null,
    storyId: storyId ?? null,
    storyTitle: storyTitle ?? null,
  }
}

export async function getArticleOptionById(id: string): Promise<CompareOption | null> {
  if (!isUuid(id)) return null

  if (isMockStoriesEnabled()) {
    for (const article of getMockArticlesForCompare(200)) {
      if (article.id === id) return toOption(article)
    }
    return null
  }

  if (!isSupabaseConfigured) return null
  try {
    const { data, error } = await supabase
      .from("articles")
      .select(`${COMPARE_ARTICLE_COLUMNS}, raw_json`)
      .eq("id", id)
      .maybeSingle()
    if (error || !data) return null
    return toOption(data as Article)
  } catch {
    return null
  }
}

/**
 * Articles related to `articleId`: the other articles clustered into the same
 * story/stories (same event, different sources), excluding the article itself.
 */
export async function getRelatedOptionsFor(
  articleId: string,
): Promise<{ related: CompareOption[]; storyId: string | null; storyTitle: string | null }> {
  if (!isUuid(articleId)) {
    return { related: [], storyId: null, storyTitle: null }
  }

  if (isMockStoriesEnabled()) {
    const story = findMockStoryByArticleId(articleId)
    if (!story) return { related: [], storyId: null, storyTitle: null }
    const related = story.articles
      .filter((a) => a.id !== articleId)
      .map((a) => toOption(a, story.id, story.title))
    return { related, storyId: story.id, storyTitle: story.title }
  }

  if (!isSupabaseConfigured) {
    return { related: [], storyId: null, storyTitle: null }
  }

  try {
    const { data: storyLinks, error: linksError } = await supabase
      .from("story_sources")
      .select("story_id")
      .eq("article_id", articleId)

    if (linksError || !storyLinks?.length) {
      return { related: [], storyId: null, storyTitle: null }
    }

    const storyIds = [...new Set(storyLinks.map((l) => l.story_id).filter(Boolean))]
      .slice(0, 20) as string[]
    const storyId = storyIds[0]

    const [{ data: stories }, { data: articleLinks }] = await Promise.all([
      supabase.from("stories").select("id, title").in("id", storyIds).limit(20),
      supabase
        .from("story_sources")
        .select("story_id, article_id")
        .in("story_id", storyIds)
        .limit(80),
    ])

    const articleIds = [
      ...new Set((articleLinks || []).map((l) => l.article_id).filter(Boolean)),
    ]
      .filter((id) => id !== articleId)
      .slice(0, 40)

    if (articleIds.length === 0) {
      return { related: [], storyId, storyTitle: stories?.[0]?.title || null }
    }

    const { data: articles } = await supabase
      .from("articles")
      .select(`${COMPARE_ARTICLE_COLUMNS}, raw_json`)
      .in("id", articleIds)
      .order("published_at", { ascending: false })
      .limit(40)

    const storyById = new Map((stories || []).map((s) => [s.id, s]))
    const storyOfArticle = new Map<string, string>()
    for (const l of articleLinks || []) {
      if (l.article_id && l.story_id) storyOfArticle.set(l.article_id, l.story_id)
    }

    const related = (articles || []).map((a) => {
      const sid = storyOfArticle.get(a.id)
      return toOption(a as Article, sid || null, storyById.get(sid || "")?.title || null)
    })

    return { related, storyId, storyTitle: stories?.[0]?.title || null }
  } catch {
    return { related: [], storyId: null, storyTitle: null }
  }
}

/** Recent articles (grouped via their stories) for picking a comparison from scratch. */
export async function getRecentCompareOptions(limit = 12): Promise<CompareOption[]> {
  if (isMockStoriesEnabled()) {
    const options: CompareOption[] = []
    const storyIds = [
      "11111111-1111-4111-8111-111111111101",
      "11111111-1111-4111-8111-111111111102",
      "11111111-1111-4111-8111-111111111103",
      "11111111-1111-4111-8111-111111111104",
      "11111111-1111-4111-8111-111111111109",
    ]
    for (const sid of storyIds.slice(0, limit)) {
      const story = getMockStoryById(sid)
      if (!story) continue
      for (const a of story.articles) {
        options.push(toOption(a, story.id, story.title))
      }
    }
    return options
  }

  if (!isSupabaseConfigured) return []

  try {
    const { data: stories } = await supabase
      .from("stories")
      .select("id, title")
      .order("created_at", { ascending: false })
      .limit(limit)

    if (!stories?.length) return []

    const storyIds = stories.map((s) => s.id)
    const { data: articleLinks } = await supabase
      .from("story_sources")
      .select("story_id, article_id")
      .in("story_id", storyIds)
      .limit(120)

    const articleIds = [
      ...new Set((articleLinks || []).map((l) => l.article_id).filter(Boolean)),
    ].slice(0, 80)

    if (articleIds.length === 0) return []

    const { data: articles } = await supabase
      .from("articles")
      .select(`${COMPARE_ARTICLE_COLUMNS}, raw_json`)
      .in("id", articleIds)
      .order("published_at", { ascending: false })
      .limit(80)

    const storyById = new Map(stories.map((s) => [s.id, s]))
    const storyOfArticle = new Map<string, string>()
    for (const l of articleLinks || []) {
      if (l.article_id && l.story_id) storyOfArticle.set(l.article_id, l.story_id)
    }

    return (articles || []).map((a) => {
      const sid = storyOfArticle.get(a.id)
      return toOption(a as Article, sid || null, storyById.get(sid || "")?.title || null)
    })
  } catch {
    return []
  }
}
