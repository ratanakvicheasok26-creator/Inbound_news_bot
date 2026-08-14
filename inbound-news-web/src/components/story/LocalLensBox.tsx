"use client"

import { useEffect, useState, useRef } from "react"

interface LocalLensBoxProps {
  category?: string
  storyTitle?: string
  storySummary?: string
}

const FALLBACK: Record<string, string> = {
  ai: "Cambodia's tech startups are increasingly adopting AI tools for agriculture, logistics, and fintech. The Ministry of Post and Telecommunications has signaled interest in AI governance frameworks, but no concrete policy exists yet.",
  cybersecurity: "Cambodia's digital economy is growing rapidly, but cybersecurity infrastructure lags behind. The National Cyber Security Centre was established in 2023, and the country is working toward alignment with ASEAN cybersecurity standards.",
  startups: "Cambodia's startup ecosystem is concentrated in Phnom Penh, with fintech and e-commerce leading investment. The government's startup visa program aims to attract foreign founders.",
  defi: "Cambodia's banking sector is exploring blockchain for cross-border payments. The National Bank has been cautious about cryptocurrency regulation, but stablecoin remittances are gaining traction among the diaspora.",
  big_tech: "Major tech companies are expanding Southeast Asian operations, with Singapore and Vietnam as primary hubs. Cambodia benefits indirectly through regional supply chains.",
  hardware: "Cambodia's hardware manufacturing is limited but growing, particularly in electronics assembly. Special economic zones attract component manufacturers from China and Japan.",
  science: "Cambodia's scientific research capacity is developing, with institutions like the Royal University of Phnom Penh expanding STEM programs.",
  regulation: "Cambodia is developing its digital economy governance framework, balancing innovation with consumer protection.",
}

function fallbackText(category?: string) {
  return FALLBACK[category || ""] || FALLBACK.ai
}

type LensCache = { text: string; fallback?: boolean }

function readCached(storyTitle?: string): LensCache | null {
  if (!storyTitle || typeof window === "undefined") return null
  try {
    const raw = localStorage.getItem(`lens-${storyTitle.slice(0, 80)}`)
    if (!raw) return null
    if (raw.startsWith("{")) {
      const parsed = JSON.parse(raw) as LensCache
      if (parsed?.text) return parsed
    }
    // Legacy plain-string cache
    return { text: raw, fallback: false }
  } catch {
    return null
  }
}

function writeCached(storyTitle: string, payload: LensCache) {
  try {
    localStorage.setItem(
      `lens-${storyTitle.slice(0, 80)}`,
      JSON.stringify(payload)
    )
  } catch {
    // ignore quota / private mode
  }
}

export function LocalLensBox({ category, storyTitle, storySummary }: LocalLensBoxProps) {
  const cached = readCached(storyTitle)
  const [text, setText] = useState<string | null>(
    () => cached?.text || (storyTitle ? null : fallbackText(category))
  )
  const [isFallback, setIsFallback] = useState(
    () => Boolean(cached?.fallback) || (!storyTitle && Boolean(category))
  )
  const [loading, setLoading] = useState(() => Boolean(storyTitle) && !cached)
  const fetched = useRef(false)

  useEffect(() => {
    if (!storyTitle || cached || fetched.current) return
    fetched.current = true

    let cancelled = false

    fetch("/api/local-lens", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: storyTitle, summary: storySummary, category }),
    })
      .then((res) => res.json().then((data) => ({ ok: res.ok, data })))
      .then(({ ok, data }) => {
        if (cancelled) return
        if (ok && data.text && !data.fallback) {
          setText(data.text)
          setIsFallback(false)
          writeCached(storyTitle, { text: data.text, fallback: false })
          return
        }
        // API error or explicit fallback — use category copy, never a blank box
        const fb = fallbackText(category)
        setText(fb)
        setIsFallback(true)
        writeCached(storyTitle, { text: fb, fallback: true })
      })
      .catch(() => {
        if (cancelled) return
        const fb = fallbackText(category)
        setText(fb)
        setIsFallback(true)
        writeCached(storyTitle, { text: fb, fallback: true })
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [category, storyTitle, storySummary, cached])

  return (
    <aside className="bg-[var(--surface)] border border-[var(--border)] rounded-[var(--radius)] p-5 border-l-4 border-l-[var(--accent)]">
      <p className="meta-text text-[var(--accent)] mb-3">Local Lens — Cambodia</p>
      {loading ? (
        <div className="space-y-2">
          <div className="h-3 bg-[var(--surface-alt)] rounded animate-pulse w-full" />
          <div className="h-3 bg-[var(--surface-alt)] rounded animate-pulse w-4/5" />
          <div className="h-3 bg-[var(--surface-alt)] rounded animate-pulse w-3/5" />
        </div>
      ) : (
        <p className="text-[14px] leading-relaxed text-[var(--text-secondary)]">
          {text}
        </p>
      )}
      {isFallback && !loading && (
        <p className="mt-2 text-[11px] text-[var(--text-secondary)] opacity-70">
          Showing category context — live Local Lens needs a Groq key or the API was busy. Try again
          later for a story-specific take.
        </p>
      )}
      {!isFallback && !loading && text && (
        <p className="mt-2 text-[11px] text-[var(--text-secondary)] opacity-60">
          AI-assisted · Cambodia framing
        </p>
      )}
    </aside>
  )
}
