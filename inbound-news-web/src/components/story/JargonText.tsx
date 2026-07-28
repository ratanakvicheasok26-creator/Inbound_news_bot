"use client"

import { useState } from "react"
import { HighlightText } from "@/components/HighlightText"
import { JargonPopover } from "@/components/JargonPopover"
import { GLOSSARY_TERMS } from "@/lib/glossary"
import type { GlossaryTerm } from "@/lib/types"

interface JargonTextProps {
  text: string
  className?: string
  onJargonTap?: () => void
}

export function JargonText({ text, className, onJargonTap }: JargonTextProps) {
  const [activeTerm, setActiveTerm] = useState<{
    term: GlossaryTerm
    position: { x: number; y: number }
  } | null>(null)

  return (
    <>
      <p className={className}>
        <HighlightText
          text={text}
          terms={GLOSSARY_TERMS}
          onTermClick={(term, position) => {
            onJargonTap?.()
            setActiveTerm({ term, position })
          }}
        />
      </p>
      {activeTerm && (
        <JargonPopover
          term={activeTerm.term}
          position={activeTerm.position}
          onClose={() => setActiveTerm(null)}
        />
      )}
    </>
  )
}
