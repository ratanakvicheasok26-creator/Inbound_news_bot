"use client"

import Link from "next/link"
import { Lock } from "lucide-react"
import { FEATURE_LABELS, TIER_LABELS, requiredTier, type Feature } from "@/lib/access"

/**
 * Locked / upgrade call-to-action shown when a user doesn't have access to a
 * feature. Follows the existing PremiumLock design language but targets the
 * exact plan tier a feature requires.
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
  const tier = requiredTier(feature)
  const tierName = TIER_LABELS[tier]
  const featureName = FEATURE_LABELS[feature]

  return (
    <div className={compact ? "rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface)] p-5" : ""}>
      <div className="flex items-center gap-2 mb-3">
        <Lock className="h-4 w-4 text-[var(--accent)]" />
        <span className="meta-text font-semibold text-[var(--accent)]">
          {tierName} members only
        </span>
      </div>

      {teaser && (
        <p className="text-[17px] sm:text-[18px] leading-[1.65] text-[var(--text-primary)] mb-4 max-w-[65ch]">
          {teaser}
          <span className="text-[var(--text-secondary)]">…</span>
        </p>
      )}

      <p className="text-[14px] text-[var(--text-secondary)] mb-5 max-w-[58ch]">
        <strong className="font-semibold text-[var(--text-primary)]">{featureName}</strong>{" "}
        is available with {tierName}. Upgrade to unlock it, plus everything in{" "}
        {tierName === "Pro" ? "Free" : "Pro"}.
      </p>

      <div className="flex flex-wrap items-center gap-3">
        <Link href="/pricing" className="btn-primary text-[14px] px-5">
          Upgrade to {tierName}
        </Link>
        <Link href="/pricing" className="btn-ghost text-[14px] px-5">
          View plans
        </Link>
      </div>
    </div>
  )
}
