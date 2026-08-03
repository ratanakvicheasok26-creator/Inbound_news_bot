"use client"

import { useState, useEffect, useRef } from "react"
import { LocalLensBox } from "@/components/story/LocalLensBox"
import { StoryTimeline, deriveTimelineNodes } from "@/components/story/StoryTimeline"
import { SourceComparisonRow } from "@/components/story/SourceComparisonRow"
import { RelatedConcepts } from "@/components/story/RelatedConcepts"
import { GLOSSARY_TERMS } from "@/lib/glossary"
import { getCategoryLabel } from "@/lib/categories"
import { formatDistanceToNow } from "@/lib/utils"
import {
  getProfile,
  trackStoryRead,
  recordSourceComparison,
} from "@/lib/profile"
import type { StoryWithArticles, Article } from "@/lib/types"
import { isUsefulSummary, resolveStoryBody } from "@/lib/story-body"
import { StoryImage } from "@/components/story/StoryImage"
import { ArrowLeft, ExternalLink, Newspaper } from "lucide-react"
import Link from "next/link"

interface StoryContentProps {
  story: StoryWithArticles
}

const KNOWN_CONCEPT_SLUGS: Record<string, { label: string; slug: string }> = {
  transformer: { label: "Transformer", slug: "transformers" },
  transformers: { label: "Transformers", slug: "transformers" },
  rag: { label: "RAG", slug: "rag" },
  llm: { label: "LLM", slug: "llm" },
  gpu: { label: "GPU", slug: "gpu" },
}

function deriveRelatedConcepts(
  tags: string[],
  title: string,
  summary: string
): { label: string; slug: string; href: string }[] {
  const found = new Map<string, { label: string; slug: string; href: string }>()

  for (const tag of tags) {
    const key = tag.toLowerCase().replace(/\s+/g, "-")
    const known = KNOWN_CONCEPT_SLUGS[key]
    if (known) {
      found.set(known.slug, { ...known, href: `/concept/${known.slug}` })
    }
  }

  const haystack = `${title} ${summary}`
  for (const term of GLOSSARY_TERMS) {
    const needle = term.term_en.toLowerCase()
    const re = new RegExp(
      `(?:^|[^a-z0-9])${needle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?:[^a-z0-9]|$)`,
      "i"
    )
    if (!re.test(haystack)) continue
    const known = KNOWN_CONCEPT_SLUGS[term.slug]
    if (known) {
      found.set(known.slug, { ...known, href: `/concept/${known.slug}` })
    } else {
      found.set(term.slug, {
        label: term.term_en,
        slug: term.slug,
        href: `/glossary#${term.slug}`,
      })
    }
  }

  return Array.from(found.values())
}

function deriveTierSummary(
  summary: string,
  tier: "eli5" | "standard" | "deep",
  articles: Article[]
): string {
  const sentences = summary.split(/(?<=[.!?])\s+/).filter(Boolean)
  if (tier === "eli5") {
    return sentences
      .slice(0, Math.max(2, Math.ceil(sentences.length / 3)))
      .map((s) =>
        s
          .replace(/\b(?:utilize|implement|facilitate|leverage|infrastructure|paradigm|methodology|comprehensive|significant|substantial|innovative|ecosystem)\b/gi, (m) => {
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
      )
      .join(" ")
  }
  if (tier === "deep") {
    const extras = articles
      .map((a) => (a.summary || "").trim())
      .filter((s) => isUsefulSummary(s) && s !== summary)
      .slice(0, 2)
    if (extras.length === 0) return summary
    return [summary, ...extras].join(" ")
  }
  return summary
}

function initialTier(): "eli5" | "standard" | "deep" {
  try {
    const tier = getProfile().preferences?.defaultTier
    if (tier === "eli5" || tier === "standard" || tier === "deep") return tier
  } catch {
    // ignore
  }
  return "standard"
}

export function StoryContent({ story }: StoryContentProps) {
  const [activeTier] = useState<"eli5" | "standard" | "deep">(initialTier)
  const sourceViewed = useRef(false)

  useEffect(() => {
    trackStoryRead({ id: story.id, title: story.title, category: story.category || "" })
  }, [story.id, story.title, story.category])

  const categoryLabel = getCategoryLabel(story.category || "") || "News"
  const articles = story.articles || []
  const tags = story.tags || []
  const body = resolveStoryBody(story)
  const relatedConcepts = deriveRelatedConcepts(tags, story.title, body)

  useEffect(() => {
    if (!sourceViewed.current && articles.length > 0) {
      sourceViewed.current = true
      recordSourceComparison()
    }
  }, [articles.length])

  const timelineNodes = deriveTimelineNodes(articles)
  const displaySummary = deriveTierSummary(body, activeTier, articles)
  const primaryUrl = story.primary_url || articles[0]?.url || null

  return (
    <div className="container pb-12">
      <div className="pt-6 pb-4">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-[var(--text-secondary)] hover:text-[var(--accent)] transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to feed
        </Link>
      </div>

      <header className="pb-8 border-b border-[var(--border)]">
        <StoryImage
          imageUrl={story.image_url}
          pageUrl={primaryUrl}
          alt={story.title}
          variant="story"
          priority
          className="mb-6 rounded-[var(--radius)]"
        />

        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-start sm:justify-between sm:gap-4 mb-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className="meta-text text-[var(--accent)]">{categoryLabel}</span>
            <span className="meta-text">
              {story.source_count} source{story.source_count !== 1 ? "s" : ""}
            </span>
            <span className="meta-text">{formatDistanceToNow(story.created_at)}</span>
          </div>
        </div>

        <h1 className="font-display text-[clamp(28px,4.5vw,44px)] font-semibold leading-[1.12] tracking-[-0.025em]">
          {story.title}
        </h1>

        <p className="mt-3 text-[14px] text-[var(--text-secondary)] max-w-[58ch]">
          Aggregated coverage from multiple sources. Local Lens adds Cambodia
          context beside the summary.
        </p>

        {primaryUrl && (
          <a
            href={primaryUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 mt-4 text-[14px] font-semibold text-[var(--accent)] hover:text-[var(--accent-hover)]"
          >
            Open source article
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
        )}
      </header>

      {timelineNodes.length > 1 && <StoryTimeline nodes={timelineNodes} />}

      <section className="py-8">
        <div className="grid gap-6 md:gap-8 lg:grid-cols-[1.5fr_0.85fr]">
          <div className="bg-[var(--surface)] border border-[var(--border)] rounded-[var(--radius)] p-4 sm:p-6 md:p-8">
            {activeTier !== "standard" && (
              <p className="meta-text text-[var(--accent)] mb-3">
                {activeTier === "eli5" ? "Simplified" : "Deep coverage"}
              </p>
            )}
            <p className="text-[17px] sm:text-[18px] leading-[1.65] text-[var(--text-primary)] max-w-[65ch]">
              {displaySummary}
            </p>
          </div>
          <div className="min-w-0">
            <LocalLensBox
              category={story.category || ""}
              storyTitle={story.title}
              storySummary={body}
            />
          </div>
        </div>
      </section>

      {relatedConcepts.length > 0 && (
        <section className="pb-6">
          <RelatedConcepts concepts={relatedConcepts} />
        </section>
      )}

      {articles.length > 0 && (
        <section className="py-6">
          <div className="section-header">
            <h2 className="section-title">
              <Newspaper className="mr-2 inline h-3.5 w-3.5" />
              Source coverage ({articles.length})
            </h2>
          </div>
          <div className="bg-[var(--surface)] border border-[var(--border)] rounded-[var(--radius)] px-5 md:px-6">
            {articles.map((article) => (
              <SourceComparisonRow key={article.id} article={article} />
            ))}
          </div>
        </section>
      )}

      {articles.length === 0 && (
        <section className="py-6">
          <div className="bg-[var(--surface)] border border-[var(--border)] rounded-[var(--radius)] p-6 text-[var(--text-secondary)]">
            No linked source articles yet for this story.
          </div>
        </section>
      )}
    </div>
  )
}
