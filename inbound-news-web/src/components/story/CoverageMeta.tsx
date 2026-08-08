import type { Story } from "@/lib/types"
import {
  coverageScore,
  OUTLET_ROLE_LABELS,
  roleForOutlet,
  type CoverageOutlet,
} from "@/lib/outlet-roles"
import { HypeRealityBar } from "@/components/story/HypeRealityBar"

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

export function CoverageMeta({
  story,
  showBar = true,
  maxNames = 3,
}: {
  story: Story
  showBar?: boolean
  maxNames?: number
}) {
  const outlets = outletsFor(story)
  const uniqueCount = Math.max(outlets.length, story.source_count || 0)
  const names = outlets.slice(0, maxNames)
  const firstRole = names[0]?.role
  const showCoverageBar = showBar && uniqueCount >= 2

  return (
    <div className="space-y-2 min-w-0">
      <div className="flex items-center gap-2 flex-wrap">
        <span className="meta-text tabular-nums">
          {uniqueCount} outlet{uniqueCount !== 1 ? "s" : ""}
        </span>
        {firstRole && (
          <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-secondary)] bg-[var(--surface-alt)] px-1.5 py-0.5 rounded-[var(--radius-sm)]">
            {OUTLET_ROLE_LABELS[firstRole]}
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
            <span className="meta-text">Coverage</span>
          </div>
          <HypeRealityBar score={coverageScore(uniqueCount)} size="sm" />
        </div>
      )}
    </div>
  )
}
