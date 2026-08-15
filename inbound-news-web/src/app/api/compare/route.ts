import { NextRequest, NextResponse } from "next/server"
import {
  type CompareArticleInput,
  type ComparisonResult,
} from "@/lib/compare-analysis"
import { getClientIp, rateLimit } from "@/lib/rate-limit"
import { requireFeature } from "@/lib/api-auth"

const GROQ_KEYS = [
  ...(process.env.GROQ_API_KEYS || "").split(","),
  ...(process.env.GROQ_API_KEY || "").split(","),
]
  .map((k) => k.trim())
  .filter(Boolean)
const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions"
const MODEL = "llama-3.1-8b-instant"
const MAX_SUMMARY_CHARS = 3000

const SYSTEM_PROMPT = `You compare two news articles. Use ONLY the article content provided below (titles, source names, published dates, and summaries). Do not use outside knowledge. Do not invent facts, names, numbers, quotes, or events. Do not present assumptions as facts. Stay neutral and never favor one source.

Return a JSON object with exactly these keys:
- "shared": array of strings — facts both articles report, each tagged with sources, e.g. "Per Reuters and BBC: ...".
- "differencesA": array of strings — information present only in the FIRST article, each tagged with its source.
- "differencesB": array of strings — information present only in the SECOND article, each tagged with its source.
- "perspectives": array of strings — how each source approaches or emphasizes the story differently, based only on what they wrote.
- "factsA": array of strings — key facts from the FIRST article, each tagged "Per <source>: ...".
- "factsB": array of strings — key facts from the SECOND article, each tagged "Per <source>: ...".
- "agreement": array of strings — points the two articles agree on.
- "disagreement": array of strings — explicit conflicting claims, showing both sides, e.g. "Article A says X; Article B says Y." If the content has no direct conflict, use exactly: "No explicit disagreement found in the available content."
- "summary": string — one short neutral paragraph summarizing the comparison.

Rules:
- If a section cannot be answered from the provided content, use exactly: "Not covered in the available content."
- Never fabricate a quote. Paraphrase only from the given text.
- Output ONLY the JSON object. No markdown fences, no extra text.`

let keyIndex = 0

function truncate(text: string, max: number): string {
  return text.length <= max ? text : `${text.slice(0, max - 1)}…`
}

function extractJsonObject(text: string): Record<string, unknown> | null {
  const cleaned = text.replace(/```(?:json)?/gi, "").trim()
  const start = cleaned.indexOf("{")
  const end = cleaned.lastIndexOf("}")
  if (start === -1 || end === -1 || end <= start) return null
  try {
    const parsed = JSON.parse(cleaned.slice(start, end + 1))
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : null
  } catch {
    return null
  }
}

function toStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value
    .map((v) => (typeof v === "string" ? v.trim() : ""))
    .filter(Boolean)
}

function coerceResult(raw: Record<string, unknown>): ComparisonResult {
  return {
    shared: toStringArray(raw.shared),
    differencesA: toStringArray(raw.differencesA),
    differencesB: toStringArray(raw.differencesB),
    perspectives: toStringArray(raw.perspectives),
    factsA: toStringArray(raw.factsA),
    factsB: toStringArray(raw.factsB),
    agreement: toStringArray(raw.agreement),
    disagreement: toStringArray(raw.disagreement),
    summary: typeof raw.summary === "string" ? raw.summary.trim() : "",
    aiGenerated: true,
  }
}

async function callGroq(prompt: string): Promise<string> {
  if (GROQ_KEYS.length === 0) {
    throw new Error("No GROQ API keys configured")
  }

  let lastError: Error | null = null

  for (let attempt = 0; attempt < GROQ_KEYS.length; attempt++) {
    const apiKey = GROQ_KEYS[keyIndex % GROQ_KEYS.length]
    keyIndex++

    try {
      const res = await fetch(GROQ_URL, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: MODEL,
          messages: [
            { role: "system", content: SYSTEM_PROMPT },
            { role: "user", content: prompt },
          ],
          max_tokens: 1400,
          temperature: 0.2,
        }),
        signal: AbortSignal.timeout(45_000),
      })

      if (res.status === 429) {
        // Rotate keys immediately — do not sleep inside the serverless request.
        lastError = new Error(`Rate limited on key ${attempt}`)
        continue
      }

      if (!res.ok) {
        lastError = new Error(`Groq ${res.status}`)
        continue
      }

      const data = await res.json()
      return data.choices?.[0]?.message?.content || ""
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err))
      continue
    }
  }

  throw lastError || new Error("All Groq keys exhausted")
}

function describe(article: CompareArticleInput): string {
  const source = article.sourceName || article.sourceDomain || "Unknown"
  const published = article.publishedAt || "Unknown"
  const content = article.summary
    ? truncate(article.summary, MAX_SUMMARY_CHARS)
    : "No summary available for this article."
  return `Source: ${source}
Published: ${published}
Title: ${article.title}
Content: ${content}`
}

export async function POST(req: NextRequest) {
  try {
    // Advanced Compare is a Pro+ feature — enforce server-side so a Free user
    // can't hit the analysis endpoint directly.
    const access = await requireFeature(req, "advanced_compare")
    if (!access.ok) {
      return NextResponse.json({ error: "membership_required" }, { status: access.status })
    }

    const limit = rateLimit(`compare:${getClientIp(req)}`, 6, 60_000)
    if (!limit.ok) {
      return NextResponse.json(
        { error: "Too many requests" },
        { status: 429, headers: { "Retry-After": String(limit.retryAfter) } }
      )
    }

    const body = await req.json().catch(() => null)
    const a = body?.a as CompareArticleInput | undefined
    const b = body?.b as CompareArticleInput | undefined

    if (!a?.id || !b?.id || !a?.title || !b?.title || a.id === b.id) {
      return NextResponse.json(
        { error: "Two different articles (a and b) are required" },
        { status: 400 },
      )
    }
    if (typeof a.title !== "string" || typeof b.title !== "string") {
      return NextResponse.json({ error: "Invalid article titles" }, { status: 400 })
    }
    if (a.title.length > 400 || b.title.length > 400) {
      return NextResponse.json({ error: "Title too long" }, { status: 400 })
    }

    const prompt = `ARTICLE A
${describe(a)}

ARTICLE B
${describe(b)}

Compare these two articles using ONLY the content above.`

    const text = await callGroq(prompt)
    const parsed = extractJsonObject(text)
    if (!parsed) {
      return NextResponse.json({ error: "Failed to parse comparison output" }, { status: 500 })
    }

    return NextResponse.json({ result: coerceResult(parsed) })
  } catch (err) {
    console.error("Compare API error:", err)
    return NextResponse.json({ error: "Comparison unavailable" }, { status: 500 })
  }
}
