"use client"

import { useState } from "react"
import { HighlightText } from "@/components/HighlightText"
import { JargonPopover } from "@/components/JargonPopover"
import { LocalLensBox } from "@/components/story/LocalLensBox"
import { GLOSSARY_TERMS } from "@/lib/glossary"
import type { GlossaryTerm } from "@/lib/types"

interface StorySummaryProps {
  summary: string
  category: string
}

export function StorySummary({ summary, category }: StorySummaryProps) {
  const [activeTerm, setActiveTerm] = useState<{
    term: GlossaryTerm
    position: { x: number; y: number }
  } | null>(null)

  return (
    <>
      <div className="grid gap-8 md:grid-cols-[7fr_3fr]">
        <div>
          <p className="text-[17px] leading-[1.7] text-[var(--text-primary)]">
            <HighlightText
              text={summary}
              terms={GLOSSARY_TERMS}
              onTermClick={(term, position) => setActiveTerm({ term, position })}
            />
          </p>
        </div>
        <div>
          <LocalLensBox category={category} />
        </div>
      </div>
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
