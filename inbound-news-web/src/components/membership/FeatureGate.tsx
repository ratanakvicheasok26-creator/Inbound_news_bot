"use client"

import type { ReactNode } from "react"
import { useMembership } from "@/lib/membership"
import { canAccess, type Feature } from "@/lib/access"
import { UpgradePrompt } from "./UpgradePrompt"

/**
 * Declarative feature gate. Renders `children` when the current user's plan
 * (from Supabase) allows the feature, otherwise renders the locked/upgrade UI.
 * Can wrap server-rendered children (composition) or live inside client pages.
 */
export function FeatureGate({
  feature,
  fallback,
  children,
}: {
  feature: Feature
  fallback?: ReactNode
  children: ReactNode
}) {
  const { loading, membership } = useMembership()

  if (loading) {
    return (
      <div className="space-y-2 animate-pulse" aria-hidden>
        <div className="h-4 w-40 rounded bg-[var(--surface-alt)]" />
        <div className="h-4 w-full rounded bg-[var(--surface-alt)]" />
        <div className="h-4 w-5/6 rounded bg-[var(--surface-alt)]" />
      </div>
    )
  }

  if (canAccess(membership, feature)) return <>{children}</>
  return <>{fallback ?? <UpgradePrompt feature={feature} />}</>
}
