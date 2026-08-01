import { supabase, isSupabaseConfigured } from "./supabase"
import { pickArticleImage, isValidImageUrl } from "./story-images"
import type { Story, Article, StoryWithArticles } from "./types"

export type StoriesResult = {
  stories: Story[]
  error: string | null
}

/**
 * Escape a value for safe use inside a PostgREST `.or()` filter string.
 */
function escapeOrValue(value: string): string {
  return `"${value.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`
}

/** Attach primary_url + best image_url from linked articles (batch). */
async function enrichStoriesWithMedia(stories: Story[]): Promise<Story[]> {
  if (stories.length === 0) return stories

  const storyIds = stories.map((s) => s.id)
  const { data: links, error: linksError } = await supabase
    .from("story_sources")
    .select("story_id, article_id")
    .in("story_id", storyIds)

  if (linksError || !links?.length) {
    if (linksError) console.error("enrich media links:", linksError)
    return stories
  }

  const articleIds = [...new Set(links.map((l) => l.article_id).filter(Boolean))]
  if (articleIds.length === 0) return stories

  const { data: articles, error: articlesError } = await supabase
    .from("articles")
    .select("id, url, source_name, source_domain, raw_json, image_url")
    .in("id", articleIds)

  if (articlesError || !articles?.length) {
    if (articlesError) console.error("enrich media articles:", articlesError)
    return stories
  }

  const articleById = new Map(articles.map((a) => [a.id, a]))
  const firstArticleByStory = new Map<string, (typeof articles)[0]>()

  for (const link of links) {
    if (!link.story_id || !link.article_id) continue
    if (firstArticleByStory.has(link.story_id)) continue
    const article = articleById.get(link.article_id)
    if (article) firstArticleByStory.set(link.story_id, article)
  }

  return stories
    .map((story) => {
      const primary = firstArticleByStory.get(story.id)
      const fromArticle = primary ? pickArticleImage(primary) : null
      const image =
        (isValidImageUrl(story.image_url) ? story.image_url : null) || fromArticle

      return {
        ...story,
        image_url: image,
        primary_url: story.primary_url || primary?.url || null,
        primary_source: story.primary_source || primary?.source_name || null,
        primary_source_domain:
          story.primary_source_domain || primary?.source_domain || null,
      }
    })
    .sort((a, b) => {
      const aHasImage = isValidImageUrl(a.image_url) ? 1 : 0
      const bHasImage = isValidImageUrl(b.image_url) ? 1 : 0
      return bHasImage - aHasImage
    })
}

export async function getAllStories(limit = 60): Promise<Story[]> {
  const { stories } = await getAllStoriesSafe(limit)
  return stories
}

export async function getAllStoriesSafe(limit = 60): Promise<StoriesResult> {
  if (!isSupabaseConfigured) {
    return { stories: [], error: "Supabase is not configured" }
  }

  try {
    const { data, error } = await supabase
      .from("stories")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(limit)

    if (error) {
      console.error("Failed to fetch stories:", error)
      return { stories: [], error: error.message }
    }
    const enriched = await enrichStoriesWithMedia(data || [])
    return { stories: enriched, error: null }
  } catch (err) {
    console.error(err)
    return { stories: [], error: "Failed to load stories" }
  }
}

export async function getStoriesByCategory(category: string): Promise<Story[]> {
  if (!isSupabaseConfigured) return []

  try {
    const { data, error } = await supabase
      .from("stories")
      .select("*")
      .eq("category", category)
      .order("created_at", { ascending: false })
      .limit(60)

    if (error) {
      console.error("Failed to fetch stories by category:", error)
      return []
    }
    return enrichStoriesWithMedia(data || [])
  } catch (err) {
    console.error(err)
    return []
  }
}

/**
 * Fetch a story by UUID id.
 * Route param is named `slug` (`/story/[slug]`) but stories have no slug column —
 * the segment is the story id.
 */
export async function getStoryById(id: string): Promise<StoryWithArticles | null> {
  if (!isSupabaseConfigured) return null

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

    const { data: storySources, error: sourcesError } = await supabase
      .from("story_sources")
      .select("article_id")
      .eq("story_id", id)

    if (sourcesError) {
      console.error("Failed to fetch story_sources:", sourcesError)
    }

    const articleIds = (storySources || []).map((s) => s.article_id).filter(Boolean)
    let articles: Article[] = []

    if (articleIds.length > 0) {
      const { data: articleData, error: articlesError } = await supabase
        .from("articles")
        .select("*")
        .in("id", articleIds)
        .order("published_at", { ascending: false })

      if (articlesError) {
        console.error("Failed to fetch articles for story:", articlesError)
      } else {
        articles = articleData || []
      }
    }

    const primary = articles[0]
    const fromArticle = primary ? pickArticleImage(primary) : null
    const image =
      (isValidImageUrl(story.image_url) ? story.image_url : null) ||
      articles.map(pickArticleImage).find(Boolean) ||
      null

    return {
      ...story,
      image_url: image || fromArticle,
      primary_url: primary?.url || null,
      primary_source: primary?.source_name || null,
      primary_source_domain: primary?.source_domain || null,
      articles,
    }
  } catch (err) {
    console.error(err)
    return null
  }
}

/** Fetch specific stories by id (for saved library). */
export async function getStoriesByIds(ids: string[]): Promise<Story[]> {
  if (!isSupabaseConfigured || ids.length === 0) return []

  try {
    const { data, error } = await supabase
      .from("stories")
      .select("*")
      .in("id", ids)

    if (error) {
      console.error("Failed to fetch stories by ids:", error)
      return []
    }
    return enrichStoriesWithMedia(data || [])
  } catch (err) {
    console.error(err)
    return []
  }
}

/**
 * Stories linked to articles whose source_domain matches `domain`
 * (via story_sources join), newest first.
 */
export async function getStoriesBySourceDomain(domain: string): Promise<Story[]> {
  if (!isSupabaseConfigured) return []

  try {
    const normalized = domain.toLowerCase().replace(/^www\./, "")

    const { data: articles, error: articlesError } = await supabase
      .from("articles")
      .select("id, source_domain")
      .ilike("source_domain", `%${normalized}%`)
      .limit(200)

    if (articlesError) {
      console.error("Failed to fetch articles by domain:", articlesError)
      return []
    }

    const articleIds = (articles || [])
      .filter((a) => {
        const d = (a.source_domain || "").toLowerCase().replace(/^www\./, "")
        return d === normalized || d.endsWith(`.${normalized}`)
      })
      .map((a) => a.id)

    if (articleIds.length === 0) return []

    const { data: storySources, error: ssError } = await supabase
      .from("story_sources")
      .select("story_id")
      .in("article_id", articleIds)

    if (ssError) {
      console.error("Failed to fetch story_sources for domain:", ssError)
      return []
    }

    const storyIds = [...new Set((storySources || []).map((s) => s.story_id).filter(Boolean))]
    if (storyIds.length === 0) return []

    const { data: stories, error: storiesError } = await supabase
      .from("stories")
      .select("*")
      .in("id", storyIds)
      .order("created_at", { ascending: false })
      .limit(60)

    if (storiesError) {
      console.error("Failed to fetch stories by source domain:", storiesError)
      return []
    }
    return enrichStoriesWithMedia(stories || [])
  } catch (err) {
    console.error(err)
    return []
  }
}

export async function getStoryStats(): Promise<{
  storyCount: number
  sourceCount: number
  categoryCount: number
}> {
  if (!isSupabaseConfigured) {
    return { storyCount: 0, sourceCount: 0, categoryCount: 0 }
  }

  try {
    const [storyResult, sourceResult, catResult] = await Promise.all([
      supabase.from("stories").select("*", { count: "exact", head: true }),
      supabase.from("articles").select("source_domain").limit(2000),
      supabase.from("stories").select("category").limit(2000),
    ])

    if (storyResult.error) console.error("Stats stories:", storyResult.error)
    if (sourceResult.error) console.error("Stats sources:", sourceResult.error)
    if (catResult.error) console.error("Stats categories:", catResult.error)

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
  } catch (err) {
    console.error(err)
    return { storyCount: 0, sourceCount: 0, categoryCount: 0 }
  }
}

export { escapeOrValue }
