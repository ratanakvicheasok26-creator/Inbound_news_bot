"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import type { Story } from "@/lib/types"
import { StoryRow } from "@/components/story/StoryRow"
import { BlindspotCard } from "@/components/story/BlindspotCard"
import {
  blindspotScore,
  blindspotWhy,
  isThinSkewed,
  isUndercovered,
  primaryOutletRole,
  type OutletRole,
} from "@/lib/outlet-roles"

/** One control — not desk + role. Industry = booster ∪ corporate. */
type CoverageLens = "all" | "research" | "critical" | "trade" | "industry" | "community"

const LENS_CHIPS: { id: CoverageLens; label: string }[] = [
  { id: "all", label: "All gaps" },
  { id: "research", label: "Research" },
  { id: "critical", label: "Critical" },
  { id: "trade", label: "Trade" },
  { id: "industry", label: "Industry" },
  { id: "community", label: "Community" },
]

function matchesLens(story: Story, lens: CoverageLens): boolean {
  if (lens === "all") return true
  const role = primaryOutletRole(story)
  if (!role) return false
  if (lens === "industry") return role === "booster" || role === "corporate"
  return role === (lens as OutletRole)
}

function sortByBlindspot(a: Story, b: Story): number {
  return (
    blindspotScore(b) - blindspotScore(a) ||
    Date.parse(b.created_at || "") - Date.parse(a.created_at || "")
  )
}

function lensLabel(lens: CoverageLens): string | null {
  if (lens === "all") return null
  return LENS_CHIPS.find((c) => c.id === lens)?.label ?? null
}

export function BlindspotExplorer({
  stories,
  error,
}: {
  stories: Story[]
  error?: string | null
}) {
  const [lens, setLens] = useState<CoverageLens>("all")

  const blindspots = useMemo(() => {
    return [...stories]
      .filter(isUndercovered)
      .filter((s) => matchesLens(s, lens))
      .sort(sortByBlindspot)
  }, [stories, lens])

  const thinSkewed = useMemo(() => {
    return [...stories]
      .filter(isThinSkewed)
      .filter((s) => matchesLens(s, lens))
      .sort(sortByBlindspot)
  }, [stories, lens])

  const featured = blindspots.slice(0, 4)
  const activeLens = lensLabel(lens)

  return (
    <>
      <div className="mb-8">
        <p className="meta-text mb-2">Coverage lens</p>
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Coverage lens">
          {LENS_CHIPS.map((chip) => (
            <button
              key={chip.id}
              type="button"
              onClick={() => setLens(chip.id)}
              className={`h-9 px-3 text-[12px] font-medium rounded-[var(--radius-sm)] border transition-colors ${
                lens === chip.id
                  ? "border-[var(--accent)] bg-[var(--accent)] text-[var(--accent-contrast)]"
                  : "border-[var(--border)] bg-[var(--surface)] text-[var(--text-secondary)] hover:border-[var(--text-secondary)]"
              }`}
            >
              {chip.label}
            </button>
          ))}
        </div>
      </div>

      {error ? (
        <div className="empty-state py-8 mb-10">
          <p className="page-title mb-2">Could not load blindspots</p>
          <p>{error}</p>
        </div>
      ) : (
        <>
          <div className="section-header">
            <h2 className="section-title">Coverage blindspots</h2>
            <span className="font-mono text-[10px] text-[var(--text-secondary)]">
              {blindspots.length} single-outlet
            </span>
          </div>
          <p className="text-[13px] text-[var(--text-secondary)] mb-5 max-w-[58ch]">
            Exactly one outlet in our cluster graph — gaps, not a full news feed.
          </p>

          {featured.length === 0 ? (
            <div className="empty-state py-10 mb-12 bg-[var(--surface)] border border-[var(--border)] rounded-[var(--radius)]">
              <p className="text-[15px] text-[var(--text-primary)] mb-1">
                No gaps{activeLens ? ` for ${activeLens}` : ""} right now
              </p>
              <p className="text-[13px]">
                Try another lens, or browse a full desk under{" "}
                <Link href="/topic/ai" className="text-[var(--accent)] hover:underline">
                  Topics
                </Link>
                . Today&apos;s digest lives in{" "}
                <Link href="/brief" className="text-[var(--accent)] hover:underline">
                  Brief
                </Link>
                .
              </p>
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 mb-8">
              {featured.map((story) => (
                <BlindspotCard
                  key={story.id}
                  title={story.title}
                  summary={story.summary_en || undefined}
                  sourceCount={story.source_count ?? 0}
                  sourceNames={
                    story.coverage_outlets?.map((o) => o.name) ||
                    (story.primary_source ? [story.primary_source] : undefined)
                  }
                  why={blindspotWhy(story)}
                  variant="blindspot"
                  href={`/story/${story.id}`}
                />
              ))}
            </div>
          )}

          {blindspots.length > 0 && (
            <div className="mb-14">
              <div className="section-header">
                <h2 className="section-title">All single-outlet gaps</h2>
                <span className="font-mono text-[10px] text-[var(--text-secondary)]">
                  {blindspots.length}
                </span>
              </div>
              <div>
                {blindspots.map((story) => (
                  <StoryRow key={story.id} story={story} />
                ))}
              </div>
            </div>
          )}

          <div className="section-header">
            <h2 className="section-title">Thin / skewed coverage</h2>
            <span className="font-mono text-[10px] text-[var(--text-secondary)]">
              {thinSkewed.length} pairs
            </span>
          </div>
          <p className="text-[13px] text-[var(--text-secondary)] mb-5 max-w-[58ch]">
            Two outlets only, same lean (industry hype or community). Still a gap — not a
            well-covered Topics story.
          </p>

          {thinSkewed.length === 0 ? (
            <div className="empty-state py-8 bg-[var(--surface)] border border-[var(--border)] rounded-[var(--radius)]">
              <p className="text-[13px]">
                No thin skewed pairs{activeLens ? ` for ${activeLens}` : ""}.
              </p>
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {thinSkewed.map((story) => (
                <BlindspotCard
                  key={story.id}
                  title={story.title}
                  summary={story.summary_en || undefined}
                  sourceCount={story.source_count ?? 0}
                  sourceNames={story.coverage_outlets?.map((o) => o.name)}
                  why={blindspotWhy(story)}
                  variant="thin"
                  href={`/story/${story.id}`}
                />
              ))}
            </div>
          )}
        </>
      )}
    </>
  )
}
