"use client"

import { useEffect } from "react"
import { createPortal } from "react-dom"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Check, ShieldCheck, X } from "lucide-react"
import { priceLabel, MEMBER_FEATURE_KEYS, planTitleKey } from "@/lib/plans"
import { useI18n } from "@/lib/i18n/LocaleProvider"
import type { MembershipPlan } from "@/lib/plans"

interface PaymentSuccessModalProps {
  plan: MembershipPlan
  onClose: () => void
}

/**
 * Confirmation shown once a payment is verified (Stripe checkout sync or an
 * approved QR submission). Lists the membership just unlocked — same product
 * for monthly and annual.
 */
export function PaymentSuccessModal({ plan, onClose }: PaymentSuccessModalProps) {
  const { t } = useI18n()
  const router = useRouter()
  const planTitle = t(planTitleKey(plan))

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose()
    }
    document.addEventListener("keydown", onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = "hidden"
    return () => {
      document.removeEventListener("keydown", onKey)
      document.body.style.overflow = prev
    }
  }, [onClose])

  return createPortal(
    <div
      className="fixed inset-0 z-[400] bg-[rgba(0,0,0,0.5)] flex items-end sm:items-center justify-center sm:p-4 max-sm:pb-[var(--mobile-nav-offset)]"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={`${planTitle} ${t("payment.planSuffix")}`}
    >
      <div
        className="w-full sm:max-w-[440px] min-w-0 bg-[var(--surface)] border border-[var(--border)] sm:rounded-[var(--radius)] rounded-t-[var(--radius)] p-4 sm:p-6 md:p-8 text-center shadow-[0_24px_64px_-24px_rgba(0,0,0,0.4)] overflow-y-auto overflow-x-hidden overscroll-contain"
        style={{
          animation: "riseIn 220ms ease-out",
          maxHeight: "min(90dvh, calc(100dvh - var(--mobile-nav-offset)))",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-2 text-left">
          <span className="text-[12px] font-semibold uppercase tracking-wide text-[var(--accent)]">
            {t("payment.verified")}
          </span>
          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 shrink-0 flex items-center justify-center rounded-[var(--radius-sm)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-alt)]"
            aria-label={t("payment.closeConfirmation")}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="mx-auto mb-4 w-16 h-16 rounded-full flex items-center justify-center bg-[var(--red-subtle-bg)]">
          <ShieldCheck className="h-8 w-8 text-[var(--accent)]" />
        </div>

        <h2 className="font-display text-[20px] sm:text-[22px] font-semibold mb-2 text-balance">
          {t("payment.welcomeMember")}
        </h2>

        <p className="text-[14px] text-[var(--text-secondary)] mb-5 max-w-[52ch] mx-auto text-pretty">
          {t("payment.membershipActive", { plan: planTitle })}{" "}
          <span className="font-semibold text-[var(--text-primary)]">{priceLabel(plan)}</span>.{" "}
          {t("payment.accessNote")}
        </p>

        <div className="text-left bg-[var(--surface-alt)] border border-[var(--border)] rounded-[var(--radius-sm)] p-4 mb-6">
          <ul className="space-y-2.5 text-[14px] text-[var(--text-primary)]">
            {MEMBER_FEATURE_KEYS.map((k) => (
              <li key={k} className="flex items-start gap-2 min-w-0">
                <Check className="h-4 w-4 shrink-0 mt-0.5 text-[var(--accent)]" />
                <span className="min-w-0 text-pretty">{t(k)}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center gap-2">
          <button
            type="button"
            onClick={() => {
              onClose()
              router.push("/")
            }}
            className="btn-primary w-full sm:flex-1 min-h-11 text-[14px]"
          >
            {t("payment.startReading")}
          </button>
          <Link
            href="/account?tab=membership"
            onClick={onClose}
            className="btn-ghost w-full sm:w-auto min-h-11 px-4 text-[14px] inline-flex items-center justify-center"
          >
            {t("account.title")}
          </Link>
        </div>
      </div>
    </div>,
    document.body
  )
}
