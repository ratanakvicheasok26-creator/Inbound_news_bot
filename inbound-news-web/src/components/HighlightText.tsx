"use client"

import { useMemo } from "react"
import type { GlossaryTerm } from "@/lib/types"

interface HighlightTextProps {
  text: string
  terms: GlossaryTerm[]
  onTermClick: (term: GlossaryTerm, position: { x: number; y: number }) => void
}

export function HighlightText({ text, terms, onTermClick }: HighlightTextProps) {
  const parts = useMemo(() => {
    if (!text || terms.length === 0) return [{ type: "text" as const, content: text }]

    const sorted = [...terms].sort((a, b) => b.term_en.length - a.term_en.length)

    const escaped = sorted.map((t) =>
      t.term_en.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
    )
    const pattern = new RegExp(`\\b(${escaped.join("|")})\\b`, "gi")

    const result: Array<{ type: "text" | "term"; content: string; term?: GlossaryTerm }> = []
    let lastIndex = 0

    for (const match of text.matchAll(pattern)) {
      const matchIndex = match.index
      const matchText = match[0]

      if (matchIndex > lastIndex) {
        result.push({ type: "text", content: text.slice(lastIndex, matchIndex) })
      }

      const matchedTerm = sorted.find(
        (t) => t.term_en.toLowerCase() === matchText.toLowerCase()
      )

      if (matchedTerm) {
        result.push({ type: "term", content: matchText, term: matchedTerm })
      } else {
        result.push({ type: "text", content: matchText })
      }

      lastIndex = matchIndex + matchText.length
    }

    if (lastIndex < text.length) {
      result.push({ type: "text", content: text.slice(lastIndex) })
    }

    return result
  }, [text, terms])

  function openTerm(term: GlossaryTerm, el: HTMLElement) {
    const rect = el.getBoundingClientRect()
    onTermClick(term, { x: rect.left, y: rect.bottom })
  }

  return (
    <>
      {parts.map((part, i) => {
        if (part.type === "term" && part.term) {
          return (
            <span
              key={`${part.term.slug}-${i}`}
              className="jargon-term"
              onClick={(e) => openTerm(part.term!, e.currentTarget)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault()
                  openTerm(part.term!, e.currentTarget)
                }
              }}
            >
              {part.content}
            </span>
          )
        }
        return <span key={`text-${i}`}>{part.content}</span>
      })}
    </>
  )
}
