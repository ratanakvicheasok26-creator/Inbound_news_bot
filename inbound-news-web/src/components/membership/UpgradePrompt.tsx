"use client"

import Link from "next/link"
import { Lock } from "lucide-react"
import { FEATURE_LABELS, type Feature } from "@/lib/access"
import { useI18n } from "@/lib/i18n/LocaleProvider"

/**
 * Locked / upgrade call-to-action when a user doesn't have access to a
 * member feature. Monthly and annual unlock the same membership.
 */
export function UpgradePrompt({
  feature,
  teaser,
  compact,
}: {
  feature: Feature
  teaser?: string | null
  compact?: boolean
}) {
  const { t } = useI18n()
  const featureName = FEATURE_LABELS[feature]

  return (
    <div className={compact ? "rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface)] p-5" : ""}>
      <div className="flex items-center gap-2 mb-3">
        <Lock className="h-4 w-4 text-[var(--accent)]" />
        <span className="meta-text font-semibold text-[var(--accent)]">
          {t("membership.membersOnlyBadge")}
        </span>
      </div>

      {teaser && (
        <p className="text-[17px] sm:text-[18px] leading-[1.65] text-[var(--text-primary)] mb-4 max-w-[65ch]">
          {teaser}
          <span className="text-[var(--text-secondary)]">…</span>
        </p>
      )}

      <p className="text-[14px] text-[var(--text-secondary)] mb-5 max-w-[58ch]">
        {t("membership.memberFeatureBody", { feature: featureName })}
      </p>

      <div className="flex flex-col sm:flex-row sm:flex-wrap items-stretch sm:items-center gap-2 sm:gap-3">
        <Link href="/pricing" className="btn-primary w-full sm:w-auto text-[14px] px-5">
          {t("membership.viewPlans")}
        </Link>
      </div>
    </div>
  )
}
