"use client"

import Link from "next/link"
import { useI18n } from "@/lib/i18n/LocaleProvider"
import type { EntitlementState } from "@/lib/access"

function formatDate(iso: string | null): string | null {
  if (!iso) return null
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return null
  return d.toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" })
}

/**
 * Displays the user's trial status in the Account / Membership tab.
 * Shows trial start, end, and days remaining — or expired state.
 */
export function TrialStatusCard({ entitlement }: { entitlement: EntitlementState }) {
  const { t } = useI18n()
  const { tier, trialStartedAt, trialEndsAt, daysRemaining } = entitlement

  if (tier === "PRO_TRIAL") {
    return (
      <div className="bg-[var(--surface)] border border-[var(--border)] rounded-[var(--radius)] p-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2 mb-1">
              <h3 className="font-display text-[18px] font-semibold">
                {t("trial.activeTitle")}
              </h3>
              <span className="text-[11px] font-semibold uppercase tracking-wide text-amber-600 dark:text-amber-400 bg-amber-500/10 rounded-full px-2 py-0.5 shrink-0">
                {t("trial.badge")}
              </span>
            </div>
            <p className="text-[14px] text-[var(--text-secondary)]">
              {t("trial.activeDescription")}
            </p>
          </div>
          <div className="text-right shrink-0">
            <p className="text-[28px] font-bold text-amber-600 dark:text-amber-400 leading-none">
              {daysRemaining}
            </p>
            <p className="text-[12px] text-[var(--text-secondary)] mt-0.5">
              {t("trial.daysRemaining")}
            </p>
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4 mt-4 border-t border-[var(--border)]">
          <div>
            <span className="text-[12px] text-[var(--text-secondary)] block">{t("trial.started")}</span>
            <span className="text-[14px] font-medium">{formatDate(trialStartedAt)}</span>
          </div>
          <div>
            <span className="text-[12px] text-[var(--text-secondary)] block">{t("trial.ends")}</span>
            <span className="text-[14px] font-medium">{formatDate(trialEndsAt)}</span>
          </div>
        </div>
      </div>
    )
  }

  if (tier === "EXPIRED") {
    return (
      <div className="bg-[var(--surface)] border border-[var(--border)] rounded-[var(--radius)] p-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2 mb-1">
              <h3 className="font-display text-[18px] font-semibold">
                {t("trial.expiredTitle")}
              </h3>
              <span className="text-[11px] font-semibold uppercase tracking-wide text-[var(--text-secondary)] bg-[var(--surface-alt)] rounded-full px-2 py-0.5 shrink-0">
                {t("trial.expiredBadge")}
              </span>
            </div>
            <p className="text-[14px] text-[var(--text-secondary)]">
              {t("trial.expiredDescription")}
            </p>
          </div>
          <Link
            href="/pricing"
            className="btn-primary w-full sm:w-auto text-[14px] min-h-10 px-5 inline-flex items-center justify-center"
          >
            {t("trial.upgradeToContinue")}
          </Link>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4 mt-4 border-t border-[var(--border)]">
          <div>
            <span className="text-[12px] text-[var(--text-secondary)] block">{t("trial.started")}</span>
            <span className="text-[14px] font-medium">{formatDate(trialStartedAt)}</span>
          </div>
          <div>
            <span className="text-[12px] text-[var(--text-secondary)] block">{t("trial.ended")}</span>
            <span className="text-[14px] font-medium">{formatDate(trialEndsAt)}</span>
          </div>
        </div>
      </div>
    )
  }

  return null
}
