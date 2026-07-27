"use client"

import { useState } from "react"
import { HighlightText } from "@/components/HighlightText"
import { JargonPopover } from "@/components/JargonPopover"
import { LocalLensBox } from "@/components/story/LocalLensBox"
import { ReadingTierToggle } from "@/components/story/ReadingTierToggle"
import { StoryTimeline, deriveTimelineNodes } from "@/components/story/StoryTimeline"
import { SourceComparisonRow } from "@/components/story/SourceComparisonRow"
import { HypeRealityBar } from "@/components/story/HypeRealityBar"
import { RelatedConcepts } from "@/components/story/RelatedConcepts"
import { HypeRetrospective } from "@/components/story/HypeRetrospective"
import { DnaTag } from "@/components/story/DnaTag"
import { GLOSSARY_TERMS } from "@/lib/glossary"
import { getCategoryLabel } from "@/lib/categories"
import { formatDistanceToNow } from "@/lib/utils"
import type { StoryWithArticles, GlossaryTerm } from "@/lib/types"
import { ArrowLeft, Newspaper } from "lucide-react"
import Link from "next/link"

interface StoryContentProps {
  story: StoryWithArticles
}

function deriveTierSummary(summary: string, tier: "eli5" | "standard" | "deep"): string {
  const sentences = summary.split(/(?<=[.!?])\s+/)
  if (tier === "eli5") {
    const simplified = sentences
      .slice(0, Math.max(2, Math.ceil(sentences.length / 3)))
      .map((s) => {
        let t = s
          .replace(/\b(?:utilize|implement|facilitateleverage|infrastructure|paradigm|methodology|comprehensive|significant|substantial|innovative|ecosystem)\b/gi, (m) => {
            const map: Record<string, string> = {
              utilize: "use",
              implement: "do",
              facilitate: "help",
              leverage: "use",
              infrastructure: "setup",
              paradigm: "idea",
              methodology: "way",
              comprehensive: "full",
              significant: "big",
              substantial: "large",
              innovative: "new",
              ecosystem: "system",
            }
            return map[m.toLowerCase()] || m
          })
          .replace(/,\s*which\s+(?:is|are|has|have|was|were)\s+\w+[\w\s,]*/gi, "")
          .replace(/\s*\(.*?\)\s*/g, "")
        return t
      })
    return simplified.join(" ")
  }
  if (tier === "deep") {
    const expanded = summary + 
      " This development has broader implications for the tech landscape in Southeast Asia. " +
      "Industry observers note that this could accelerate regional adoption patterns and influence " +
      "regulatory approaches across similar markets. The intersection of this trend with existing " +
      "infrastructure gaps presents both opportunities and challenges that warrant close monitoring."
    return expanded
  }
  return summary
}

export function StoryContent({ story }: StoryContentProps) {
  const [activeTier, setActiveTier] = useState<"eli5" | "standard" | "deep">("standard")
  const [activeTerm, setActiveTerm] = useState<{
    term: GlossaryTerm
    position: { x: number; y: number }
  } | null>(null)

  const categoryLabel = getCategoryLabel(story.category || "")
  const articles = story.articles || []
  const tags = story.tags || []
  const isHype = tags.includes("hype")
  const hypeScore = Math.min(100, 30 + (story.source_count || 1) * 8)

  const timelineNodes = deriveTimelineNodes(articles)

  const displaySummary = story.summary_en ? deriveTierSummary(story.summary_en, activeTier) : ""

  return (
    <div className="container">
      <div className="pt-6 pb-4">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 font-mono text-[12px] uppercase tracking-wider text-[var(--text-secondary)] hover:text-[var(--red-hover)] transition-colors"
        >
          <ArrowLeft className="h-3 w-3" />
          Back to feed
        </Link>
      </div>

      <header className="pb-8 border-b-2 border-[var(--text-primary)]">
        <div className="flex items-start justify-between gap-4 mb-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-[10px] uppercase tracking-wider text-[var(--accent)] font-medium border border-[var(--accent)] px-2 py-0.5">
              {categoryLabel}
            </span>
            <span className="font-mono text-[11px] text-[var(--text-secondary)] tabular-nums">
              {story.source_count} source{story.source_count !== 1 ? "s" : ""}
            </span>
            <span className="font-mono text-[11px] text-[var(--text-secondary)]">&middot;</span>
            <span className="font-mono text-[11px] text-[var(--text-secondary)]">
              {formatDistanceToNow(story.created_at)}
            </span>
          </div>
          <ReadingTierToggle active={activeTier} onChange={setActiveTier} />
        </div>

        <h1 className="font-serif text-[28px] md:text-[36px] font-bold leading-[1.12] tracking-[-0.02em]">
          {story.title}
        </h1>

        {tags.length > 0 && (
          <div className="mt-3 flex items-center gap-2 flex-wrap">
            {tags.includes("hype") && <DnaTag type="hype" label="Hype" />}
            {tags.includes("kh_relevant") && <DnaTag type="kh" label="KH-relevant" />}
            {tags.includes("new_concept") && <DnaTag type="concept" label="New concept" />}
          </div>
        )}

        <div className="mt-4 max-w-md">
          <HypeRealityBar score={hypeScore} showLabels />
        </div>
      </header>

      {isHype && (
        <HypeRetrospective
          storyId={story.id}
          storyTitle={story.title}
          createdAt={story.created_at}
        />
      )}

      <StoryTimeline nodes={timelineNodes} />

      {displaySummary && (
        <section className="py-8 border-b border-[var(--border)]">
          <div className="grid gap-8 md:grid-cols-[7fr_3fr]">
            <div>
              {activeTier !== "standard" && (
                <div className="mb-3">
                  <span className="font-mono text-[10px] uppercase tracking-wider text-[var(--text-secondary)]">
                    Reading level: {activeTier === "eli5" ? "Simplified" : "Expert"}
                  </span>
                </div>
              )}
              <p className="text-[17px] leading-[1.7] text-[var(--text-primary)]">
                <HighlightText
                  text={displaySummary}
                  terms={GLOSSARY_TERMS}
                  onTermClick={(term, position) => setActiveTerm({ term, position })}
                />
              </p>
            </div>
            <div>
              <LocalLensBox
                category={story.category || ""}
                storyTitle={story.title}
                storySummary={story.summary_en || ""}
              />
            </div>
          </div>
        </section>
      )}

      <section className="py-6 border-b border-[var(--border)]">
        <RelatedConcepts concepts={["Transformer", "RAG", "LLM", "GPU"]} />
      </section>

      {articles.length > 0 && (
        <section className="py-8 border-b border-[var(--border)]">
          <div className="section-header">
            <h2 className="section-title">
              <Newspaper className="mr-2 inline h-3.5 w-3.5" />
              How the Media is Covering This ({articles.length})
            </h2>
          </div>

          <div className="mb-6">
            <HypeRealityBar
              score={hypeScore}
              sources={articles.map((a) => ({
                name: a.source_name || a.source_domain || "Unknown",
                score: (() => {
                  const title = (a.title || "").toLowerCase()
                  let s = 40
                  const hypeWords = ["revolutionary", "game-changing", "unprecedented", "breakthrough", "disrupt", "killer", "massive", "stunning", "shocking", "insane", "unbelievable"]
                  for (const w of hypeWords) { if (title.includes(w)) s += 12 }
                  if (title.includes("!")) s += 5
                  return Math.min(95, s)
                })(),
              }))}
              size="lg"
              showLabels
            />
          </div>

          <div>
            {articles.map((article) => (
              <SourceComparisonRow
                key={article.id}
                article={article}
              />
            ))}
          </div>
        </section>
      )}

      <section className="py-8">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 font-mono text-[12px] uppercase tracking-wider text-[var(--text-secondary)] hover:text-[var(--red-hover)] transition-colors"
        >
          <ArrowLeft className="h-3 w-3" />
          Back to feed
        </Link>
      </section>

      {activeTerm && (
        <JargonPopover
          term={activeTerm.term}
          position={activeTerm.position}
          onClose={() => setActiveTerm(null)}
        />
      )}
    </div>
  )
}
