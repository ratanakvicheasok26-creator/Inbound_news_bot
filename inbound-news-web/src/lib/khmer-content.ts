import type { User } from "@supabase/supabase-js"
import type { SupabaseClient } from "@supabase/supabase-js"
import { callGemini, callGroq } from "./groq"
import { rateLimit } from "./rate-limit"
import { canAccessTier, type PlanTier } from "./access"

/**
 * AI-generated Khmer content pipeline.
 *
 * The Khmer *UI* is free for every plan; this library controls the depth of
 * AI-generated Khmer content, gated through the same centralized feature
 * permissions (lib/access.ts) used everywhere else.
 *
 *   Free   → basic Khmer summary (title + a few article summaries, daily cap)
 *   Pro    → full Khmer Decode (every linked source, translated + recombined)
 *   Premium→ full Khmer Decode, no daily cap
 *
 * Translation flow mirrors the Telegram bot's EN→KM pipeline (newsbot/ai.py):
 * the Khmer content is the same story, only in a different language — the
 * English body is translated wholesale like the KM bot mirrors the EN bot's
 * post, backed by validated per-article translations:
 *   1. Translate with strict Khmer-language instructions (brands/acronyms/
 *      numbers stay Latin, never a full English sentence).
 *   2. Validate the output actually contains Khmer script before it is
 *      accepted or cached — Latin-only output is never cached, so one bad AI
 *      response can never poison the shared `article_translations` cache.
 *   3. Rescue chain: JSON parse → field-by-field single-text translation →
 *      direct full-post translation → English fallback (panel stays readable).
 *
 * Translations are cached in `article_translations` (article_id, 'km') and
 * reused across members, so an article is translated by the AI at most once.
 */

export type KhmerLevel = "basic" | "full"

export interface KhmerArticleSource {
  id: string
  title: string
  summary: string | null
  source_name: string | null
}

export interface KhmerContent {
  level: KhmerLevel
  title: string
  body: string
  articles: { id: string; title: string; summary: string | null; source_name: string | null }[]
  translatedCount: number
  totalCount: number
  limited: boolean
}

/** Free plan cap: how many source articles a Free user may translate per story. */
const FREE_MAX_ARTICLES = 2

/** Free plan daily translation budget (per user). */
const FREE_DAILY_LIMIT = 3

/** Pro/Premium burst guard (per user, rolling hour) — not a content cap. */
const PAID_HOURLY_LIMIT = 40

const DAY_KEY = () => new Date().toISOString().slice(0, 10)

// Khmer Unicode block — detects when the model ignored the language
// instructions (mirrors _KHMER_RE in newsbot/ai.py).
const _KHMER_RE = /[\u1780-\u17FF]/

const TRANSLATION_SYSTEM = `You are a professional Khmer translator for a technology news desk based in Phnom Penh.
Translate the news article below into natural, fluent Khmer (Khmer script).
Rules:
- Keep brand names, company names, product names, people's names, and technical acronyms in their original English form (e.g. SpaceX, ChatGPT, AI, GPU, Apple, Google, NVIDIA).
- Write numbers as digits (e.g. 500, 7%).
- If a technical term has no common Khmer equivalent, keep it in English inside the Khmer sentence instead of switching the whole sentence to English.
- Never output an entire sentence in English.
- Keep the meaning faithful to the original; do not add opinion, commentary, or your own facts.
Return ONLY a JSON object with exactly these keys:
- "title": the Khmer translation of the title
- "summary": the Khmer translation of the summary
If the source has no summary, return "summary": "".`

const SINGLE_TEXT_SYSTEM = `You are a Khmer translator.
Translate the tech news text into Khmer (Khmer script).
Keep brand names, company names, product names, and numbers as-is.
Write natural Khmer — never reply with an entire English sentence.
Reply with only the translation, no quotes, no commentary.`

const FULL_POST_SYSTEM = `You are a professional tech news translator.
Translate the following tech news post into natural, fluent Khmer (Khmer script).
Rules:
1. Preserve all HTML tags (<b>, </b>, <i>, </i>, <a>, </a>, etc.) and list markers exactly as they appear in the original post.
2. Keep brand names, company names, product names, people's names, and technical acronyms in their original English form (e.g. SpaceX, ChatGPT, AI, GPU, Apple, Google, NVIDIA).
3. Write numbers as digits (e.g. 500, 7%).
4. Maintain the exact same paragraph structure, line breaks, and list formatting.
5. If a technical term has no common Khmer equivalent, keep it in English inside the Khmer sentence.
6. Output ONLY the translated post text — no markdown code fences, no commentary.`

function containsKhmer(text: string): boolean {
  return Boolean(text && _KHMER_RE.test(text))
}

/**
 * Prefer Gemini for Khmer translation (the Telegram bot's pipeline does the
 * same — Gemini handles Khmer script far better than the Llama models), with
 * Groq as fallback when no Gemini key is set or the call fails.
 */
async function callAI(system: string, prompt: string, maxTokens: number): Promise<string> {
  const gemini = await callGemini({ system, prompt, maxTokens })
  if (gemini) return gemini
  return callGroq({ system, prompt, maxTokens })
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

/**
 * Best-effort single-text Khmer translation (mirrors _translate_to_khmer in
 * newsbot/ai.py). Returns the translation when it contains Khmer script,
 * otherwise returns the original text so callers can detect failure.
 */
async function translateToKhmer(text: string): Promise<string> {
  if (!text || !text.trim()) return ""
  const trimmed = text.trim().slice(0, 800)
  try {
    const result = await callAI(SINGLE_TEXT_SYSTEM, trimmed, 400)
    const translated = result.trim()
    if (containsKhmer(translated)) return translated
  } catch {
    // fall through — caller validates and retries elsewhere
  }
  return text
}

/**
 * Direct full-post EN→KM translation (mirrors translate_en_post_to_km in
 * newsbot/ai.py): an exact structural copy of the post in Khmer, preserving
 * HTML tags and list formatting. Returns null when the output lacks Khmer
 * script, so callers never post Latin-only content.
 */
async function translateEnPostToKm(enText: string): Promise<string | null> {
  if (!enText || !enText.trim()) return null
  try {
    const text = await callAI(
      FULL_POST_SYSTEM,
      `English post:\n\n${enText.trim()}`,
      1400,
    )
    const output = text
      .replace(/^```(?:html)?\s*\n?/gi, "")
      .replace(/\n?```$/g, "")
      .trim()
    if (!output || !containsKhmer(output)) return null
    return output
  } catch {
    return null
  }
}

async function translateArticle(
  article: KhmerArticleSource,
): Promise<{ title: string; summary: string | null } | null> {
  const prompt = `TITLE: ${article.title}\nSUMMARY: ${article.summary || ""}`
  const text = await callAI(TRANSLATION_SYSTEM, prompt, 800)

  let title = ""
  let summary: string | null = ""
  const parsed = extractJsonObject(text)
  if (parsed) {
    title =
      typeof parsed.title === "string" && parsed.title.trim() ? parsed.title.trim() : ""
    summary =
      typeof parsed.summary === "string" && parsed.summary.trim() ? parsed.summary.trim() : ""
  }

  // Rescue: the model returned valid JSON but ignored the Khmer instructions
  // (or parsing failed) — translate each non-Khmer field single-shot.
  if (title && !containsKhmer(title)) {
    title = await translateToKhmer(title)
  }
  if (summary && !containsKhmer(summary)) {
    summary = await translateToKhmer(summary)
  }

  if (!containsKhmer(title)) {
    // Title is the minimum deliverable — without Khmer script there is
    // nothing worth caching (mirrors KhmerTranslationFailed, no poison cache).
    return null
  }
  if (summary && !containsKhmer(summary)) {
    // Never persist an English summary under the Khmer cache entry.
    summary = null
  }

  return { title, summary: summary || null }
}

function isUsefulKhmerSummary(summary: string | null | undefined): boolean {
  if (!summary || summary.trim().length < 40) return false
  return true
}

/**
 * Resolve (and generate, when missing) the Khmer translation for an article.
 * Reads the shared cache first; only calls the AI when nothing is cached.
 * Only Khmer-validated translations are ever written to the cache.
 */
async function getOrCreateTranslation(
  supabase: SupabaseClient,
  article: KhmerArticleSource,
): Promise<{ title: string; summary: string | null } | null> {
  const { data: cached } = await supabase
    .from("article_translations")
    .select("translated_title, translated_summary")
    .eq("article_id", article.id)
    .eq("language", "km")
    .maybeSingle()

  if (cached?.translated_title) {
    if (!containsKhmer(cached.translated_title)) {
      // A Latin-only row made it in before validation — ignore it and
      // regenerate rather than serving English as Khmer.
      console.warn(
        `Ignoring invalid cached Khmer translation for article ${article.id} (no Khmer script)`,
      )
    } else {
      return {
        title: cached.translated_title,
        summary: cached.translated_summary || null,
      }
    }
  }

  const translated = await translateArticle(article)
  if (!translated) return null

  await supabase
    .from("article_translations")
    .upsert(
      {
        article_id: article.id,
        language: "km",
        translated_title: translated.title,
        translated_summary: translated.summary,
      },
      { onConflict: "article_id,language" },
    )
    .then(({ error }) => {
      if (error) console.error("Failed to cache Khmer translation:", error)
    })

  return translated
}

export function allowedLevel(tier: PlanTier): KhmerLevel {
  return canAccessTier(tier, "khmer_decode") ? "full" : "basic"
}

/** Daily budget check for Free-tier Khmer usage. */
export function canUseFreeTranslation(userId: string): boolean {
  return rateLimit(`khmer:${userId}:${DAY_KEY()}`, FREE_DAILY_LIMIT, 24 * 60 * 60 * 1000).ok
}

/** Burst guard for Pro/Premium Khmer generation. */
export function canUsePaidTranslation(userId: string): boolean {
  return rateLimit(`khmer-paid:${userId}:${DAY_KEY()}`, PAID_HOURLY_LIMIT, 60 * 60 * 1000).ok
}

/**
 * Compose the English story body exactly as the story page renders it
 * (summary_en, deepened with the most useful article summaries). The Khmer
 * Decode is a wholesale mirror of this — same content, only different
 * language — like the KM bot mirrors the EN bot's post via translate_en_post_to_km.
 */
function composeEnglishBody(opts: {
  story: { id: string; title: string; summary_en: string | null }
  articles: KhmerArticleSource[]
}): string {
  const summaries = opts.articles
    .map((a) => (a.summary || "").trim())
    .filter((s) => s.length >= 48)
    .sort((a, b) => b.length - a.length)

  const primary =
    opts.story.summary_en?.trim() || summaries[0] || ""
  if (!primary) return ""

  const parts: string[] = [primary]
  for (const a of opts.articles) {
    const s = (a.summary || "").trim()
    if (s.length >= 48 && !primary.includes(s.slice(0, 80))) {
      parts.push(`${a.title} — ${s}`)
    }
    if (parts.length >= 4) break
  }
  return parts.join("\n\n")
}

/**
 * Build the Khmer version of a story. Articles come pre-joined from the story.
 * Follows the Telegram bot's mirror flow: the Khmer Decode is the same story
 * content as the English page, only in a different language — the English body
 * is translated wholesale (translate_en_post_to_km) exactly like the KM bot
 * mirrors the EN bot's post. Per-article translations (cached + Khmer-validated)
 * back the source list and act as the fallback body.
 */
export async function buildKhmerContent(opts: {
  supabase: SupabaseClient
  user: User
  tier: PlanTier
  story: { id: string; title: string; summary_en: string | null }
  articles: KhmerArticleSource[]
}): Promise<KhmerContent> {
  const level = allowedLevel(opts.tier)
  const full = level === "full"

  const articlePool = opts.articles.slice(0, 40)
  const cap = full ? articlePool.length : Math.min(FREE_MAX_ARTICLES, articlePool.length)

  const out: KhmerContent = {
    level,
    title: opts.story.title,
    body: "",
    articles: [],
    translatedCount: 0,
    totalCount: articlePool.length,
    limited: !full,
  }

  // Prefer stories that already have useful English summaries so the Khmer
  // body has real substance to work from, not empty shells.
  const ordered = [...articlePool].sort((a, b) => {
    const al = a.summary?.length ?? 0
    const bl = b.summary?.length ?? 0
    return bl - al
  })

  const translated: { title: string; summary: string | null; source_name: string | null }[] = []

  for (const article of ordered.slice(0, cap)) {
    const t = await getOrCreateTranslation(opts.supabase, article)
    if (t) {
      out.translatedCount++
      translated.push({ ...t, source_name: article.source_name })
      out.articles.push({
        id: article.id,
        title: t.title,
        summary: t.summary,
        source_name: article.source_name,
      })
    }
  }

  // Title mirror: prefer the cached translated lead headline (very close to
  // the story title); otherwise translate the story title itself.
  const leadTranslated = translated[0]
  if (leadTranslated?.title) {
    out.title = leadTranslated.title
  } else {
    const storyTitleKm = await translateToKhmer(opts.story.title)
    out.title = containsKhmer(storyTitleKm) ? storyTitleKm : opts.story.title
  }

  if (full) {
    // Full Decode = wholesale Khmer mirror of the English story body.
    const enBody = composeEnglishBody(opts)
    const kmMirror = enBody ? await translateEnPostToKm(enBody) : null
    if (kmMirror) {
      out.body = kmMirror
      return out
    }
  }

  // Fallback body: mirror assembled from the cached per-article translations.
  const useful = translated.map((t) => t.summary).filter(isUsefulKhmerSummary) as string[]
  if (useful.length > 0) {
    const best = useful[0]
    const rest = useful.slice(1, full ? 3 : 1)
    out.body = rest.length > 0 ? `${best}\n\n${rest.join("\n\n")}` : best
  } else if (translated.length > 0) {
    out.body = translated
      .map((t) => t.summary)
      .filter((s): s is string => Boolean(s))
      .join("\n\n")
  }

  // Last resort: keep the story readable rather than showing an empty box.
  if (!out.body) {
    const english = [opts.story.summary_en, ...opts.articles.map((a) => a.summary)]
      .map((s) => (s || "").trim())
      .filter((s) => s.length >= 40)
      .sort((a, b) => b.length - a.length)
    out.body = english[0] ?? `${opts.story.title}.`
  }

  return out
}
