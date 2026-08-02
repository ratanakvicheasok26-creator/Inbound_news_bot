import { NextRequest, NextResponse } from "next/server"
import { supabase, isSupabaseConfigured } from "@/lib/supabase"
import { escapeOrValue } from "@/lib/posts"

const STORY_SELECT =
  "id, title, summary_en, category, tags, created_at, image_url"
const ARTICLE_SELECT =
  "id, title, summary, url, source_name, source_domain, published_at, image_url"

/**
 * Split a query into tokens. A query must match EVERY token (AND) so that
 * multi-word searches like "openai gpt" work even when no field contains the
 * exact phrase. Tokens are sanitized so they are safe inside `.or()` filters.
 */
function tokenize(q: string): string[] {
  return q
    .replace(/[{},"\\%_]/g, " ")
    .split(/\s+/)
    .map((t) => t.trim())
    .filter((t) => t.length >= 1)
    .slice(0, 6)
}

/**
 * Tokenized AND search across a table. Each token must match at least one of
 * `fields`; results are the intersection across tokens, newest first.
 */
async function searchTable(
  table: "stories" | "articles",
  tokens: string[],
  fields: string[],
  select: string,
  orderBy: string,
): Promise<unknown[]> {
  if (tokens.length === 0) return []

  let candidateIds: string[] | null = null

  for (const token of tokens) {
    const or = fields
      .map((f) =>
        f === "tags"
          ? `tags.cs.{${token}}`
          : `${f}.ilike.${escapeOrValue(`%${token}%`)}`,
      )
      .join(",")

    const { data, error } = await supabase
      .from(table)
      .select("id")
      .or(or)
      .limit(200)

    if (error) {
      console.error(`Search ${table} tokens:`, error)
      return []
    }

    const ids = (data ?? []).map((r) => r.id as string)
    candidateIds =
      candidateIds === null ? ids : candidateIds.filter((id) => ids.includes(id))
    if (candidateIds.length === 0) return []
  }

  if (!candidateIds?.length) return []

  const { data, error } = await supabase
    .from(table)
    .select(select)
    .in("id", candidateIds.slice(0, 100))
    .order(orderBy, { ascending: false })
    .limit(20)

  if (error) {
    console.error(`Search ${table} details:`, error)
    return []
  }
  return data ?? []
}

export async function GET(req: NextRequest) {
  try {
    if (!isSupabaseConfigured) {
      return NextResponse.json(
        { stories: [], articles: [], error: "Search is unavailable" },
        { status: 503 },
      )
    }

    const q = req.nextUrl.searchParams.get("q")?.trim()
    if (!q || q.length < 1) {
      return NextResponse.json({ stories: [], articles: [] })
    }
    if (q.length > 100) {
      return NextResponse.json(
        { stories: [], articles: [], error: "Search query too long" },
        { status: 400 },
      )
    }

    const tokens = tokenize(q)
    if (tokens.length === 0) {
      return NextResponse.json({ stories: [], articles: [] })
    }

    const [stories, articles] = await Promise.all([
      searchTable(
        "stories",
        tokens,
        ["title", "summary_en", "tags", "category"],
        STORY_SELECT,
        "created_at",
      ),
      searchTable(
        "articles",
        tokens,
        ["title", "summary", "source_name", "source_domain"],
        ARTICLE_SELECT,
        "published_at",
      ),
    ])

    return NextResponse.json({
      stories,
      articles,
      tokens,
      error: null,
    })
  } catch (error) {
    console.error("Search API error:", error)
    return NextResponse.json({ stories: [], articles: [], error: "Search failed" }, { status: 500 })
  }
}
