"use client"

import type { Story } from "@/lib/types"
import {
  coverageScore,
  roleForOutlet,
  type CoverageOutlet,
  type OutletRole,
} from "@/lib/outlet-roles"
import { HypeRealityBar } from "@/components/story/HypeRealityBar"
import { useI18n } from "@/lib/i18n/LocaleProvider"

function outletsFor(story: Story): CoverageOutlet[] {
  if (story.coverage_outlets?.length) return story.coverage_outlets
  if (story.primary_source || story.primary_source_domain) {
    return [
      {
        name: story.primary_source || story.primary_source_domain || "Source",
        domain: story.primary_source_domain || "",
        role: roleForOutlet({
          source_name: story.primary_source,
          source_domain: story.primary_source_domain,
        }),
      },
    ]
  }
  return []
}

function roleMix(outlets: CoverageOutlet[]): [OutletRole, number][] {
  const counts: Partial<Record<OutletRole, number>> = {}
  for (const o of outlets) {
    counts[o.role] = (counts[o.role] || 0) + 1
  }
  return (Object.entries(counts) as [OutletRole, number][]).sort((a, b) => b[1] - a[1])
}

export function CoverageMeta({
  story,
  showBar = true,
  maxNames = 3,
  compact = false,
}: {
  story: Story
  showBar?: boolean
  maxNames?: number
  /** Hide role mix chips (cards). */
  compact?: boolean
}) {
  const { t } = useI18n()
  const outlets = outletsFor(story)
  const uniqueCount = Math.max(outlets.length, story.source_count || 0)
  const names = outlets.slice(0, maxNames)
  const mix = roleMix(outlets)
  const showCoverageBar = showBar && uniqueCount >= 2

  return (
    <div className="space-y-2 min-w-0">
      <div className="flex items-center gap-2 flex-wrap">
        <span className="meta-text tabular-nums">
          {uniqueCount}{" "}
          {uniqueCount !== 1 ? t("coverage.outlets") : t("coverage.singleOutlet")}
        </span>
        {!compact &&
          mix.slice(0, 3).map(([role, n]) => (
            <span
              key={role}
              className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-secondary)] bg-[var(--surface-alt)] px-1.5 py-0.5 rounded-[var(--radius-sm)]"
              title={`${t(`outletRoles.${role}`)} ${t("coverage.outlets")} — ${t("coverage.coverage")}`}
            >
              {t(`outletRoles.${role}`)}
              {n > 1 ? ` ×${n}` : ""}
            </span>
          ))}
        {compact && mix[0] && (
          <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-secondary)] bg-[var(--surface-alt)] px-1.5 py-0.5 rounded-[var(--radius-sm)]">
            {t(`outletRoles.${mix[0][0]}`)}
          </span>
        )}
      </div>
      {names.length > 0 && (
        <p className="text-[12px] text-[var(--text-secondary)] leading-snug line-clamp-1">
          {names.map((o) => o.name).join(" · ")}
          {outlets.length > maxNames ? " · …" : ""}
        </p>
      )}
      {showCoverageBar && (
        <div className="pt-0.5">
          <div className="flex items-center justify-between gap-2 mb-1">
            <span className="meta-text">{t("coverage.intensity")}</span>
            <span className="meta-text tabular-nums">{uniqueCount}</span>
          </div>
          <HypeRealityBar score={coverageScore(uniqueCount)} size="sm" />
        </div>
      )}
    </div>
  )
}
