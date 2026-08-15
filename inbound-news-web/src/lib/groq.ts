/**
 * Shared Groq LLM helper (round-robin across GROQ_API_KEYS / GROQ_API_KEY).
 * Mirrors the pattern already used by /api/compare and /api/local-lens so all
 * LLM call sites share one config.
 */

const GROQ_KEYS = [
  ...(process.env.GROQ_API_KEYS || "").split(","),
  ...(process.env.GROQ_API_KEY || "").split(","),
]
  .map((k) => k.trim())
  .filter(Boolean)

const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions"
// llama-3.1-8b-instant is too weak for Khmer — the Telegram bot's pipeline
// uses llama-3.3-70b-versatile (Groq) with gemini-flash preferred for Khmer,
// so this site matches those defaults.
const DEFAULT_MODEL = process.env.GROQ_MODEL || "llama-3.3-70b-versatile"

const GEMINI_KEYS = (process.env.GOOGLE_GEMINI_API_KEY || "")
  .split(",")
  .map((k) => k.trim())
  .filter(Boolean)

let keyIndex = 0
let geminiKeyIndex = 0

export function isGroqConfigured(): boolean {
  return GROQ_KEYS.length > 0
}

export async function callGroq(params: {
  system: string
  prompt: string
  model?: string
  maxTokens?: number
}): Promise<string> {
  if (GROQ_KEYS.length === 0) {
    throw new Error("No GROQ API keys configured")
  }

  const model = params.model ?? DEFAULT_MODEL
  const maxTokens = params.maxTokens ?? 1400

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
          model,
          messages: [
            { role: "system", content: params.system },
            { role: "user", content: params.prompt },
          ],
          max_tokens: maxTokens,
          temperature: 0.2,
        }),
        signal: AbortSignal.timeout(60_000),
      })

      if (res.status === 429) {
        lastError = new Error(`Rate limited on key ${attempt}`)
        continue
      }
      if (!res.ok) {
        lastError = new Error(`Groq ${res.status}`)
        continue
      }

      const data = await res.json()
      const content: string = data.choices?.[0]?.message?.content || ""
      if (content) return content
      lastError = new Error("Empty Groq response")
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err))
      continue
    }
  }

  throw lastError || new Error("All Groq keys exhausted")
}

/**
 * Gemini chat via the public REST API (no SDK dependency). The Telegram bot's
 * pipeline prefers Gemini for Khmer because it handles Khmer script far better
 * than the Llama models — the website mirrors that preference. Returns null
 * when no key is configured or the call fails, so callers fall back to Groq.
 */
export async function callGemini(params: {
  system: string
  prompt: string
  maxTokens?: number
}): Promise<string | null> {
  if (GEMINI_KEYS.length === 0) return null

  const model = process.env.GEMINI_MODEL?.trim() || "gemini-flash-latest"
  const maxTokens = params.maxTokens ?? 1400

  for (let attempt = 0; attempt < GEMINI_KEYS.length; attempt++) {
    const apiKey = GEMINI_KEYS[geminiKeyIndex % GEMINI_KEYS.length]
    geminiKeyIndex++

    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            systemInstruction: { parts: [{ text: params.system }] },
            contents: [{ role: "user", parts: [{ text: params.prompt }] }],
            generationConfig: { temperature: 0.2, maxOutputTokens: maxTokens },
          }),
          signal: AbortSignal.timeout(60_000),
        },
      )
      if (!res.ok) continue

      const data = await res.json()
      const parts: { text?: string }[] =
        data?.candidates?.[0]?.content?.parts ?? []
      const text = parts
        .map((p) => p.text ?? "")
        .join("")
        .trim()
      if (text) return text
    } catch {
      continue
    }
  }

  return null
}
