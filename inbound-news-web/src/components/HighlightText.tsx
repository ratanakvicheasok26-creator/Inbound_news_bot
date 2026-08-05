"use client"

import { useMemo } from "react"
import type { GlossaryTerm } from "@/lib/types"
import { glossaryMatchForms } from "@/lib/glossary"

interface HighlightTextProps {
  text: string
  terms: GlossaryTerm[]
  onTermClick: (term: GlossaryTerm, position: { x: number; y: number }) => void
}

export function HighlightText({ text, terms, onTermClick }: HighlightTextProps) {
  const parts = useMemo(() => {
    if (!text || terms.length === 0) return [{ type: "text" as const, content: text }]

    // Build form → term map; longer forms win when sorted into the regex
    const formToTerm = new Map<string, GlossaryTerm>()
    const allForms: string[] = []
    for (const term of terms) {
      for (const form of glossaryMatchForms(term)) {
        const key = form.toLowerCase()
        if (!formToTerm.has(key)) formToTerm.set(key, term)
        allForms.push(form)
      }
    }

    const uniqueForms = Array.from(new Set(allForms)).sort((a, b) => b.length - a.length)
    if (uniqueForms.length === 0) {
      return [{ type: "text" as const, content: text }]
    }

    const escaped = uniqueForms.map((f) => f.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
    const pattern = new RegExp(`\\b(${escaped.join("|")})\\b`, "gi")

    const result: Array<{ type: "text" | "term"; content: string; term?: GlossaryTerm }> = []
    let lastIndex = 0

    for (const match of text.matchAll(pattern)) {
      const matchIndex = match.index ?? 0
      const matchText = match[0]

      if (matchIndex > lastIndex) {
        result.push({ type: "text", content: text.slice(lastIndex, matchIndex) })
      }

      const matchedTerm = formToTerm.get(matchText.toLowerCase())
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
