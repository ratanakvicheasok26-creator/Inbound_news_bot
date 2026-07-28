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

export function LocalLensBox({ category, storyTitle, storySummary }: LocalLensBoxProps) {
  const [text, setText] = useState<string | null>(() => {
    if (!storyTitle) return FALLBACK[category || ""] || FALLBACK.ai;
    const cacheKey = `lens-${storyTitle.slice(0, 80)}`;
    return typeof window !== "undefined" ? localStorage.getItem(cacheKey) : null;
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(false)
  const fetched = useRef(false)

  useEffect(() => {
    if (fetched.current || text !== null || !storyTitle) return

    fetched.current = true
    setLoading(true)

    const cacheKey = `lens-${storyTitle.slice(0, 80)}`
    fetch("/api/local-lens", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: storyTitle, summary: storySummary, category }),
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.text) {
          setText(data.text)
          try { localStorage.setItem(cacheKey, data.text) } catch {}
        } else {
          throw new Error(data.error || "No text returned")
        }
      })
      .catch(() => {
        setError(true)
        setText(FALLBACK[category || ""] || FALLBACK.ai)
      })
      .finally(() => setLoading(false))
  }, [category, storyTitle, storySummary, text])

  return (
    <div className="bg-[var(--text-primary)] p-5 text-[var(--bg)] border-t-3 border-[var(--accent)]">
      <p className="font-mono text-[10px] uppercase tracking-[0.12em] font-bold text-[var(--accent)] mb-2">
        Local Lens — Cambodia
      </p>
      {loading ? (
        <div className="space-y-2">
          <div className="h-3 bg-[#333] animate-pulse w-full" />
          <div className="h-3 bg-[#333] animate-pulse w-4/5" />
          <div className="h-3 bg-[#333] animate-pulse w-3/5" />
        </div>
      ) : (
        <p className="text-[13px] leading-relaxed opacity-90">
          {text}
        </p>
      )}
      {error && (
        <p className="mt-2 font-mono text-[9px] opacity-50">
          Fallback text shown — AI generation unavailable
        </p>
      )}
    </div>
  )
}
