"use client"

import { useEffect } from "react"
import { createPortal } from "react-dom"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Check, ShieldCheck, X } from "lucide-react"
import { PLANS, PLAN_FEATURES, priceLabel } from "@/lib/plans"
import type { MembershipPlan } from "@/lib/plans"

interface PaymentSuccessModalProps {
  plan: MembershipPlan
  onClose: () => void
}

/**
 * Confirmation popup shown once a payment is verified (Stripe checkout sync or
 * an approved QR submission). Proves the payment went through and lists the
 * benefits the member just unlocked.
 */
export function PaymentSuccessModal({ plan, onClose }: PaymentSuccessModalProps) {
  const router = useRouter()
  const meta = PLANS[plan]

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
      className="fixed inset-0 z-[400] bg-[rgba(0,0,0,0.5)] flex items-end sm:items-center justify-center p-0 sm:p-4"
      style={{ paddingBottom: "var(--mobile-nav-offset)" }}
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={`${meta.name} membership confirmed`}
    >
      <div
        className="w-full sm:max-w-[440px] bg-[var(--surface)] border border-[var(--border)] sm:rounded-[var(--radius)] rounded-t-[var(--radius)] p-6 md:p-8 text-center shadow-[0_24px_64px_-24px_rgba(0,0,0,0.4)] overflow-y-auto"
        style={{
          animation: "riseIn 220ms ease-out",
          maxHeight: "calc(100dvh - var(--mobile-nav-offset) - 24px)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-2 text-left">
          <span className="text-[12px] font-semibold uppercase tracking-wide text-[var(--accent)]">
            Payment verified
          </span>
          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 shrink-0 flex items-center justify-center rounded-[var(--radius-sm)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-alt)]"
            aria-label="Close confirmation"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="mx-auto mb-4 w-16 h-16 rounded-full flex items-center justify-center bg-[var(--red-subtle-bg)]">
          <ShieldCheck className="h-8 w-8 text-[var(--accent)]" />
        </div>

        <h2 className="font-display text-[22px] font-semibold mb-2">
          Welcome to {meta.name}!
        </h2>

        <p className="text-[14px] text-[var(--text-secondary)] mb-5 max-w-[52ch] mx-auto">
          Your {meta.name} membership is active at{" "}
          <span className="font-semibold text-[var(--text-primary)]">{priceLabel(plan)}</span>.
          Here&rsquo;s what you now have access to:
        </p>

        <div className="text-left bg-[var(--surface-alt)] border border-[var(--border)] rounded-[var(--radius-sm)] p-4 mb-6">
          <ul className="space-y-2.5 text-[14px] text-[var(--text-primary)]">
            {PLAN_FEATURES[plan].map((f) => (
              <li key={f} className="flex items-start gap-2">
                <Check className="h-4 w-4 shrink-0 mt-0.5 text-[var(--accent)]" />
                {f}
              </li>
            ))}
          </ul>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              onClose()
              router.push("/")
            }}
            className="btn-primary flex-1 h-11 text-[14px]"
          >
            Start reading
          </button>
          <Link
            href="/account?tab=membership"
            onClick={onClose}
            className="btn-ghost h-11 px-4 text-[14px]"
          >
            Account
          </Link>
        </div>
      </div>
    </div>,
    document.body
  )
}
