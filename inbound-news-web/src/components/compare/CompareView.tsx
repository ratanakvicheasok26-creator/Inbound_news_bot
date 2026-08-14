"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { ArrowLeft, GitCompareArrows, RefreshCw } from "lucide-react"
import type { CompareOption } from "@/lib/compare"
import {
  deterministicComparison,
  NOT_COVERED,
  type CompareArticleInput,
  type ComparisonResult,
} from "@/lib/compare-analysis"
import { ArticleCard } from "./ArticleCard"
import { ArticlePicker } from "./ArticlePicker"
import { recordSourceComparison } from "@/lib/profile"

interface CompareViewProps {
  articleA: CompareOption | null
  articleB: CompareOption | null
  relatedToA: CompareOption[]
  recentOptions: CompareOption[]
  storyTitle: string | null
}

function toInput(opt: CompareOption): CompareArticleInput {
  return {
    id: opt.id,
    title: opt.title,
    sourceName: opt.source_name,
    sourceDomain: opt.source_domain,
    publishedAt: opt.published_at,
    summary: opt.summary,
  }
}

function compareCacheKey(a: CompareOption, b: CompareOption): string {
  return `compare-v1:${[a.id, b.id].sort().join("|")}`
}

function readCompareCache(key: string): ComparisonResult | null {
  if (typeof window === "undefined") return null
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as ComparisonResult) : null
  } catch {
    return null
  }
}

function writeCompareCache(key: string, result: ComparisonResult): void {
  try {
    localStorage.setItem(key, JSON.stringify(result))
  } catch {
    // storage full / unavailable — ignore
  }
}

function BulletList({ items }: { items: string[] }) {
  if (!items.length) {
    return (
      <p className="text-[13px] text-[var(--text-secondary)] italic">{NOT_COVERED}</p>
    )
  }
  return (
    <ul className="space-y-2.5">
      {items.map((item, i) => (
        <li key={i} className="flex gap-2.5 text-[14px] leading-relaxed text-[var(--text-primary)]">
          <span className="mt-[9px] h-1 w-1 shrink-0 rounded-full bg-[var(--text-secondary)]" aria-hidden />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  )
}

function AnalysisSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="bg-[var(--surface)] border border-[var(--border)] rounded-[var(--radius)] p-5 md:p-6">
      <h2 className="section-title mb-4">{title}</h2>
      {children}
    </section>
  )
}

function AnalysisView({
  result,
  loading,
  a,
  b,
}: {
  result: ComparisonResult | null
  loading: boolean
  a: CompareOption
  b: CompareOption
}) {
  const sourceA = a.source_name || a.source_domain || "Article A"
  const sourceB = b.source_name || b.source_domain || "Article B"

  if (loading || !result) {
    return (
      <div className="space-y-6 animate-pulse">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="bg-[var(--surface)] border border-[var(--border)] rounded-[var(--radius)] p-6 space-y-3"
          >
            <div className="h-3 w-40 bg-[var(--surface-alt)] rounded" />
            <div className="h-3 w-full bg-[var(--surface-alt)] rounded" />
            <div className="h-3 w-5/6 bg-[var(--surface-alt)] rounded" />
            <div className="h-3 w-4/6 bg-[var(--surface-alt)] rounded" />
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <AnalysisSection title="What they both say">
        <BulletList items={result.shared} />
      </AnalysisSection>

      <AnalysisSection title="Key differences">
        <div className="grid gap-5 md:grid-cols-2">
          <div>
            <p className="meta-text mb-2.5 text-[var(--accent)]">Only in {sourceA}</p>
            <BulletList items={result.differencesA} />
          </div>
          <div>
            <p className="meta-text mb-2.5 text-[var(--accent)]">Only in {sourceB}</p>
            <BulletList items={result.differencesB} />
          </div>
        </div>
      </AnalysisSection>

      <AnalysisSection title="Different perspectives">
        <BulletList items={result.perspectives} />
      </AnalysisSection>

      <AnalysisSection title="Key facts">
        <div className="grid gap-5 md:grid-cols-2">
          <div>
            <p className="meta-text mb-2.5 text-[var(--accent)]">{sourceA}</p>
            <BulletList items={result.factsA} />
          </div>
          <div>
            <p className="meta-text mb-2.5 text-[var(--accent)]">{sourceB}</p>
            <BulletList items={result.factsB} />
          </div>
        </div>
      </AnalysisSection>

      <AnalysisSection title="Agreement / Disagreement">
        <div className="grid gap-5 md:grid-cols-2">
          <div>
            <p className="meta-text mb-2.5 text-[var(--green-substance)]">They agree on</p>
            <BulletList items={result.agreement} />
          </div>
          <div>
            <p className="meta-text mb-2.5 text-[var(--accent)]">They do not agree on</p>
            <BulletList items={result.disagreement} />
          </div>
        </div>
      </AnalysisSection>

      <AnalysisSection title="Summary">
        <p className="text-[15px] leading-relaxed text-[var(--text-primary)]">{result.summary}</p>
      </AnalysisSection>
    </div>
  )
}

export function CompareView({
  articleA,
  articleB,
  relatedToA,
  recentOptions,
  storyTitle,
}: CompareViewProps) {
  const router = useRouter()
  const showResult = Boolean(articleA && articleB)
  const fixedA = Boolean(articleA)

  const [pickingB, setPickingB] = useState(false)
  const [slotA, setSlotA] = useState<CompareOption | null>(articleA)
  const [slotB, setSlotB] = useState<CompareOption | null>(articleB)
  const [activeSlot, setActiveSlot] = useState<"a" | "b">(articleA ? "b" : "a")
  const [result, setResult] = useState<ComparisonResult | null>(null)
  const [analysisLoading, setAnalysisLoading] = useState(false)
  const [analysisError, setAnalysisError] = useState(false)
  const countedPair = useRef<string>("")

  useEffect(() => {
    if (!articleA || !articleB) return
    let cancelled = false

    const key = compareCacheKey(articleA, articleB)
    const cached = readCompareCache(key)
    if (cached) {
      /* eslint-disable react-hooks/set-state-in-effect -- restore cached analysis without refetching */
      setResult(cached)
      /* eslint-enable react-hooks/set-state-in-effect */
      return
    }

    setAnalysisLoading(true)
    setAnalysisError(false)
    fetch("/api/compare", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ a: toInput(articleA), b: toInput(articleB) }),
    })
      .then((res) => res.json())
      .then((data) => {
        if (cancelled) return
        if (data.result) {
          setResult(data.result as ComparisonResult)
          writeCompareCache(key, data.result as ComparisonResult)
        } else {
          throw new Error(data.error || "No result")
        }
      })
      .catch(() => {
        if (cancelled) return
        setAnalysisError(true)
        setResult(deterministicComparison(toInput(articleA), toInput(articleB)))
      })
      .finally(() => {
        if (!cancelled) setAnalysisLoading(false)
      })

    const pairId = [articleA.id, articleB.id].sort().join("|")
    if (countedPair.current !== pairId) {
      countedPair.current = pairId
      recordSourceComparison()
    }

    return () => {
      cancelled = true
    }
  }, [articleA, articleB])

  const pickOptions = useMemo(() => {
    if (fixedA) return relatedToA.length ? relatedToA : recentOptions
    return recentOptions
  }, [fixedA, relatedToA, recentOptions])

  const pickerLabel = fixedA
    ? relatedToA.length
      ? storyTitle
        ? `Related coverage — ${storyTitle}`
        : "Related coverage"
      : "Recent articles"
    : "Recent articles"

  const excludeIds = [slotA?.id, slotB?.id].filter(Boolean) as string[]

  function handleSelectOption(opt: CompareOption) {
    if (activeSlot === "a") {
      setSlotA(opt)
      if (!slotB) setActiveSlot("b")
    } else {
      setSlotB(opt)
    }
  }

  function handleCompare() {
    if (!slotA || !slotB) return
    router.push(`/compare?a=${slotA.id}&b=${slotB.id}`)
  }

  function handlePickDifferentB(opt: CompareOption) {
    if (!articleA) return
    router.push(`/compare?a=${articleA.id}&b=${opt.id}`)
  }

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

      <header className="pb-8">
        <p className="chip mb-3">
          <GitCompareArrows className="h-3 w-3" />
          Compare
        </p>
        <h1 className="page-title">Comparing articles</h1>
        <p className="mt-2 max-w-[58ch] text-[14px] leading-relaxed text-[var(--text-secondary)]">
          Pick two related articles to read them side by side — what they both say, where they
          differ, and how each source frames the story.
        </p>
      </header>

      {showResult && articleA && articleB ? (
        <>
          <div className="grid gap-6 md:grid-cols-2 mb-8">
            <ArticleCard option={articleA} slot="A" />
            <ArticleCard option={articleB} slot="B" />
          </div>

          <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
            <h2 className="section-title">Analysis</h2>
            <button type="button" className="btn-ghost" onClick={() => setPickingB((p) => !p)}>
              <RefreshCw className="h-3.5 w-3.5" />
              {pickingB ? "Hide article picker" : "Compare a different article"}
            </button>
          </div>

          {pickingB && (
            <div className="mb-8">
              <ArticlePicker
                options={relatedToA.length ? relatedToA : recentOptions}
                excludeIds={[articleA.id, articleB.id]}
                selectedId={articleB.id}
                onSelect={handlePickDifferentB}
                contextLabel={pickerLabel}
              />
            </div>
          )}

          {analysisError && (
            <p className="mb-4 text-[13px] text-[var(--text-secondary)] rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--surface-alt)] px-3 py-2">
              Live AI compare unavailable (rate limit or missing Groq key) — showing a free local
              comparison from the two summaries. Try again later for a deeper framing analysis.
            </p>
          )}

          <AnalysisView result={result} loading={analysisLoading} a={articleA} b={articleB} />

          <p className="mt-6 text-[12px] leading-relaxed text-[var(--text-secondary)]">
            Analysis uses only the two articles&apos; titles and summaries. Claims are attributed
            to their source. Where sources conflict, both sides are shown. Original articles remain
            authoritative.
          </p>
        </>
      ) : (
        <>
          <div className="grid gap-6 md:grid-cols-2 mb-8">
            <ArticleCard
              option={slotA}
              slot="A"
              active={activeSlot === "a" && !fixedA}
              onChoose={fixedA ? undefined : () => setActiveSlot("a")}
            />
            <ArticleCard
              option={slotB}
              slot="B"
              active={activeSlot === "b"}
              onChoose={() => setActiveSlot("b")}
            />
          </div>

          <div className="mb-8">
            <ArticlePicker
              options={pickOptions}
              excludeIds={excludeIds}
              selectedId={activeSlot === "a" ? slotA?.id ?? null : slotB?.id ?? null}
              onSelect={handleSelectOption}
              contextLabel={pickerLabel}
            />
          </div>

          {slotA && slotB && (
            <div className="flex justify-center">
              <button type="button" className="btn-primary" onClick={handleCompare}>
                <GitCompareArrows className="h-4 w-4" />
                Compare Articles
              </button>
            </div>
          )}
        </>
      )}
    </div>
  )
}
