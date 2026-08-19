"use client"

import type { ReactNode } from "react"
import { useEntitlement } from "@/lib/membership"
import { requiredTier, type Feature } from "@/lib/access"
import { UpgradePrompt } from "./UpgradePrompt"

/**
 * Declarative feature gate. Renders `children` when the current user's plan
 * (from Supabase) allows the feature, otherwise renders the locked/upgrade UI.
 * Considers both paid subscriptions and active 42-day free trials.
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
  const { loading, entitlement } = useEntitlement()

  if (loading) {
    return (
      <div className="space-y-2 animate-pulse" aria-hidden>
        <div className="h-4 w-40 rounded bg-[var(--surface-alt)]" />
        <div className="h-4 w-full rounded bg-[var(--surface-alt)]" />
        <div className="h-4 w-5/6 rounded bg-[var(--surface-alt)]" />
      </div>
    )
  }

  if (entitlement.hasProAccess || requiredTier(feature) === "free") return <>{children}</>
  return <>{fallback ?? <UpgradePrompt feature={feature} />}</>
}
