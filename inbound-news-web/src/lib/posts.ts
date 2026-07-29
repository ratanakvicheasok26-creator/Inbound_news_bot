import { supabase } from "./supabase"
import type { Story, Article, StoryWithArticles } from "./types"

export async function getAllStories(): Promise<Story[]> {
  try {
    const { data, error } = await supabase
      .from("stories")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(50)

    if (error) {
      console.error("Failed to fetch stories:", error)
      return []
    }
    return data || []
  } catch {
    return []
  }
}

export async function getStoriesByCategory(category: string): Promise<Story[]> {
  try {
    const { data, error } = await supabase
      .from("stories")
      .select("*")
      .eq("category", category)
      .order("created_at", { ascending: false })
      .limit(50)

    if (error) {
      console.error("Failed to fetch stories by category:", error)
      return []
    }
    return data || []
  } catch {
    return []
  }
}

/**
 * Fetch a story by UUID id.
 * Route param is named `slug` (`/story/[slug]`) but stories have no slug column —
 * the segment is the story id.
 */
export async function getStoryById(id: string): Promise<StoryWithArticles | null> {
  try {
    const { data: story, error: storyError } = await supabase
      .from("stories")
      .select("*")
      .eq("id", id)
      .single()

    if (storyError || !story) {
      console.error("Failed to fetch story:", storyError)
      return null
    }

    const { data: storySources } = await supabase
      .from("story_sources")
      .select("article_id")
      .eq("story_id", id)

    const articleIds = (storySources || []).map((s) => s.article_id)
    let articles: Article[] = []

    if (articleIds.length > 0) {
      const { data: articleData } = await supabase
        .from("articles")
        .select("*")
        .in("id", articleIds)
        .order("published_at", { ascending: false })

      articles = articleData || []
    }

    const primary = articles[0]
    return {
      ...story,
      primary_url: primary?.url || null,
      primary_source: primary?.source_name || null,
      primary_source_domain: primary?.source_domain || null,
      articles,
    }
  } catch {
    return null
  }
}

export async function getStoryStats(): Promise<{
  storyCount: number
  sourceCount: number
  categoryCount: number
}> {
  try {
    // storyCount: exact head count (no row payload).
    // sourceCount / categoryCount: PostgREST has no COUNT(DISTINCT) without a DB RPC.
    // We select only the distinct-key columns and unique in JS (no inventing migrations).
    const [storyResult, sourceResult, catResult] = await Promise.all([
      supabase.from("stories").select("*", { count: "exact", head: true }),
      supabase.from("articles").select("source_domain"),
      supabase.from("stories").select("category"),
    ])

    const uniqueSources = new Set(
      (sourceResult.data || []).map((a) => a.source_domain).filter(Boolean)
    )
    const uniqueCategories = new Set(
      (catResult.data || []).map((s) => s.category).filter(Boolean)
    )

    return {
      storyCount: storyResult.count || 0,
      sourceCount: uniqueSources.size,
      categoryCount: uniqueCategories.size,
    }
  } catch {
    return { storyCount: 0, sourceCount: 0, categoryCount: 0 }
  }
}
