import { NextRequest, NextResponse } from "next/server"

const GROQ_KEYS = (process.env.GROQ_API_KEYS || "").split(",").filter(Boolean)
const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions"
const MODEL = "llama-3.1-8b-instant"

const SYSTEM_PROMPT = `You are a tech news analyst focused on Cambodia. Given a global tech story, write a 2-3 sentence "Local Lens" paragraph explaining why this matters specifically for Cambodia. Focus on: Cambodian job markets, local startup ecosystems, government digital policy, ASEAN regional context, or everyday impacts for Cambodian people. Write in clear, accessible English. Do not use jargon. Be specific and factual — reference real Cambodian institutions, policies, or economic realities when possible. Do not use markdown formatting.`

let keyIndex = 0

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
          max_tokens: 200,
          temperature: 0.3,
        }),
      })

      if (res.status === 429) {
        const retryAfter = res.headers.get("Retry-After")
        const waitMs = retryAfter ? parseInt(retryAfter, 10) * 1000 : 2000
        await new Promise((r) => setTimeout(r, waitMs))
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

export async function POST(req: NextRequest) {
  try {
    const { title, summary, category } = await req.json()

    if (!title) {
      return NextResponse.json({ error: "title is required" }, { status: 400 })
    }

    const prompt = `Story title: "${title}"
${summary ? `Summary: "${summary}"` : ""}
${category ? `Category: ${category}` : ""}

Explain why this story matters specifically for Cambodia.`

    const text = await callGroq(prompt)

    return NextResponse.json({ text })
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
