import { NextRequest, NextResponse } from "next/server"
import { getClientIp, rateLimit } from "@/lib/rate-limit"

const EXA_API_KEY = process.env.EXA_API_KEY?.trim() || ""
const EXA_URL = "https://api.exa.ai/search"
const TIMEOUT_MS = 15_000

export type WebSearchResult = {
  title: string
  url: string
  source_name: string
  source_domain: string
  summary: string
  published_at: string | null
}

function extractDomain(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "")
  } catch {
    return ""
  }
}

/**
 * Live web search powered by Exa.ai. Called from the client so it can never
 * expose the API key, and kept separate from the database search so local
 * results stay instant even when the web call is slow or unavailable.
 */
export async function GET(req: NextRequest) {
  if (!EXA_API_KEY) {
    return NextResponse.json(
      { results: [], available: false, error: "Web search is not configured" },
      { status: 503 },
    )
  }

  const q = req.nextUrl.searchParams.get("q")?.trim()
  if (!q) {
    return NextResponse.json({ results: [], available: true })
  }
  if (q.length > 100) {
    return NextResponse.json({ results: [], available: true })
  }

  const limit = rateLimit(`websearch:${getClientIp(req)}`, 20, 60_000)
  if (!limit.ok) {
    return NextResponse.json(
      { results: [], available: true, error: "Too many requests" },
      { status: 429, headers: { "Retry-After": String(limit.retryAfter) } },
    )
  }

  try {
    const resp = await fetch(EXA_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${EXA_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        query: q,
        numResults: 10,
        category: "news",
        useAutoprompt: true,
        startPublishedDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
          .toISOString()
          .slice(0, 10),
      }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
      cache: "no-store",
    })

    if (!resp.ok) {
      console.error("Web search HTTP error:", resp.status)
      return NextResponse.json(
        { results: [], available: true, error: "Web search failed" },
        { status: 502 },
      )
    }

    const data = await resp.json()
    const results: WebSearchResult[] = (data.results ?? []).flatMap(
      (item: Record<string, unknown>) => {
        const url = typeof item.url === "string" ? item.url : ""
        const title = typeof item.title === "string" ? item.title.trim() : ""
        if (!url || !title) return []

        const text = typeof item.text === "string" ? item.text : ""
        let publishedAt: string | null = null
        if (typeof item.publishedDate === "string") {
          const parsed = new Date(item.publishedDate.replace("Z", "+00:00"))
          if (!Number.isNaN(parsed.getTime())) publishedAt = parsed.toISOString()
        }

        const domain = extractDomain(url)
        return [
          {
            title,
            url,
            source_name: domain,
            source_domain: domain,
            summary: text.slice(0, 300),
            published_at: publishedAt,
          },
        ]
      },
    )

    return NextResponse.json({ results, available: true, error: null })
  } catch (error) {
    console.error("Web search API error:", error)
    return NextResponse.json(
      { results: [], available: true, error: "Web search failed" },
      { status: 500 },
    )
  }
}
