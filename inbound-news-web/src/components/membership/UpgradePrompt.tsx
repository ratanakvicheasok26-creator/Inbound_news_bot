"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { Lock, Sparkles, ArrowRight } from "lucide-react"
import { FEATURE_LABELS, type Feature } from "@/lib/access"
import { useI18n } from "@/lib/i18n/LocaleProvider"
import { getCurrentUser, supabase, type AuthUser } from "@/lib/auth"

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
  const [user, setUser] = useState<AuthUser | null>(null)

  useEffect(() => {
    let cancelled = false
    getCurrentUser().then((u) => {
      if (!cancelled) setUser(u)
    })

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!cancelled) {
        if (session?.user) {
          getCurrentUser().then((u) => {
            if (!cancelled) setUser(u)
          })
        } else {
          setUser(null)
        }
      }
    })

    return () => {
      cancelled = true
      authListener?.subscription.unsubscribe()
    }
  }, [])

  return (
    <div className={compact ? "rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface)] p-5" : "rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 md:p-8"}>
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

      <p className="text-[15px] font-medium text-[var(--text-primary)] mb-1 max-w-[58ch]">
        {t("membership.memberFeatureBody", { feature: featureName })}
      </p>

      {!user && (
        <p className="text-[13px] text-[var(--text-secondary)] mb-6 max-w-[58ch] flex items-center gap-1.5">
          <Sparkles className="h-3.5 w-3.5 text-[var(--accent)] shrink-0" />
          <span>{t("promo.subtitle")}</span>
        </p>
      )}

      <div className={`flex flex-col sm:flex-row sm:flex-wrap items-stretch sm:items-center gap-2 sm:gap-3 ${user ? "mt-4" : ""}`}>
        {!user ? (
          <>
            <Link href="/signup" className="btn-primary w-full sm:w-auto text-[14px] px-5 inline-flex items-center justify-center gap-2">
              <Sparkles className="h-4 w-4" />
              {t("promo.cta")} — {t("promo.title")}
            </Link>
            <Link href="/pricing" className="btn-ghost border border-[var(--border)] w-full sm:w-auto text-[14px] px-4 inline-flex items-center justify-center">
              {t("membership.viewPlans")}
            </Link>
          </>
        ) : (
          <Link href="/pricing" className="btn-primary w-full sm:w-auto text-[14px] px-5 inline-flex items-center justify-center gap-2">
            <span>{t("membership.viewPlans")}</span>
            <ArrowRight className="h-4 w-4" />
          </Link>
        )}
      </div>
    </div>
  )
}
