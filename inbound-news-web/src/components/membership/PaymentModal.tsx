"use client"

import { useState, useEffect } from "react"
import { createPortal } from "react-dom"
import Image from "next/image"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { X, Check, ShieldCheck } from "lucide-react"
import { PLANS, PLAN_FEATURES } from "@/lib/plans"
import { paymentQrUrl } from "@/lib/payment-qr"
import { submitQrPayment } from "@/lib/membership"
import type { MembershipPlan } from "@/lib/plans"
import type { QrSubmission } from "@/lib/membership"

interface PaymentModalProps {
  plan: MembershipPlan
  onClose: () => void
}

type Step = "qr" | "done"

/**
 * QR-code payment dialog for a single membership plan. The price is derived
 * from the plan metadata and can't be edited. After paying by QR, the user taps
 * "I've paid" and immediately sees the verification-pending message. A site
 * admin verifies the payment in their bank app and approves it on /admin/qr
 * before the membership activates.
 */
export function PaymentModal({ plan, onClose }: PaymentModalProps) {
  const router = useRouter()
  const meta = PLANS[plan]
  const price = `$${meta.price.toFixed(2)}/${meta.cadence}`

  const [step, setStep] = useState<Step>("qr")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  const [submission, setSubmission] = useState<QrSubmission | null>(null)

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") close()
    }
    document.addEventListener("keydown", onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = "hidden"
    return () => {
      document.removeEventListener("keydown", onKey)
      document.body.style.overflow = prev
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function close() {
    onClose()
  }

  async function handleSubmit() {
    setError("")
    setBusy(true)

    const res = await submitQrPayment(plan)
    if ("submission" in res && res.submission) {
      setSubmission(res.submission)
      setStep("done")
    } else if (res.error === "auth") {
      close()
      router.push("/login?returnTo=/pricing")
    } else if (res.error === "already_member") {
      setError("You're already a member — premium stories are unlocked. Close and refresh to read.")
    } else {
      setError(res.error || "Something went wrong — please try again.")
    }
    setBusy(false)
  }

  return createPortal(
    <div
      className="fixed inset-0 z-[400] bg-[rgba(0,0,0,0.5)] flex items-center justify-center p-4"
      onClick={close}
      role="dialog"
      aria-modal="true"
      aria-label={`Pay for ${meta.name} plan`}
    >
      <div
        className="w-full max-w-[440px] bg-[var(--surface)] border border-[var(--border)] rounded-[var(--radius)] p-6 md:p-8 text-center shadow-[0_24px_64px_-24px_rgba(0,0,0,0.4)] max-h-[92vh] overflow-y-auto"
        style={{ animation: "riseIn 220ms ease-out" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-1 text-left">
          <h2 className="font-display text-[18px] font-semibold">{meta.name} Plan</h2>
          <button
            type="button"
            onClick={close}
            className="w-9 h-9 flex items-center justify-center rounded-[var(--radius-sm)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-alt)]"
            aria-label="Close payment dialog"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <p className="text-[28px] font-semibold leading-none mb-6">{price}</p>

        {step === "qr" && (
          <>
            <div className="flex items-center justify-center gap-2 mb-4">
              <span className="meta-text text-[var(--accent)]">KHQR payment</span>
            </div>

            <a
              href={paymentQrUrl(plan)}
              target="_blank"
              rel="noopener noreferrer"
              className="relative block w-full max-w-[300px] aspect-square mx-auto mb-5 bg-[var(--surface)] p-2 transition-opacity hover:opacity-80"
            >
              <Image
                src={paymentQrUrl(plan)}
                alt={`KHQR payment for ${meta.name} plan`}
                fill
                sizes="300px"
                priority
                className="object-contain"
              />
            </a>

            <p className="text-[14px] text-[var(--text-secondary)] mb-1">
              Scan with any KHQR-compatible app
            </p>
            <p className="text-[13px] text-[var(--text-secondary)]">
              ABA Bank · Inbound Crew
            </p>
            <p className="text-[13px] text-[var(--text-secondary)] mt-2">
              Pay <span className="font-semibold text-[var(--text-primary)]">exactly ${meta.price.toFixed(2)}</span>
            </p>

            {error && (
              <p
                className="mt-4 p-3 rounded-[var(--radius-sm)] bg-[var(--red-subtle-bg)] text-[13px] font-semibold text-[var(--accent)]"
                role="alert"
              >
                {error}
              </p>
            )}

            <button
              type="button"
              onClick={handleSubmit}
              disabled={busy}
              className="btn-primary w-full h-11 mt-5 disabled:opacity-50"
            >
              {busy ? "Confirming…" : "Verification"}
            </button>
          </>
        )}

        {step === "done" && submission && (
          <div>
            <div className="mx-auto mb-4 w-14 h-14 rounded-full flex items-center justify-center bg-[var(--red-subtle-bg)]">
              <ShieldCheck className="h-7 w-7 text-[var(--accent)]" />
            </div>

            <div className="text-[12px] font-semibold uppercase tracking-wide text-[var(--accent)] mb-3">
              Payment received — verification pending
            </div>

            <p className="text-[14px] text-[var(--text-secondary)] mb-2 max-w-[52ch] mx-auto">
              Your payment of{" "}
              <span className="font-semibold text-[var(--text-primary)]">
                ${meta.price.toFixed(2)}
              </span>{" "}
              has been recorded. You&apos;ll see it on your account page until it&apos;s approved.
            </p>

            <div className="text-left bg-[var(--surface-alt)] border border-[var(--border)] rounded-[var(--radius-sm)] p-4 mb-5">
              <p className="text-[12px] font-semibold uppercase tracking-wide text-[var(--text-secondary)] mb-2">
                What you get once verified
              </p>
              <ul className="space-y-2 text-[14px] text-[var(--text-primary)]">
                {PLAN_FEATURES[plan].map((f) => (
                  <li key={f} className="flex items-start gap-2">
                    <Check className="h-4 w-4 shrink-0 mt-0.5 text-[var(--accent)]" />
                    {f}
                  </li>
                ))}
              </ul>
            </div>

            <p className="text-[13px] text-[var(--text-secondary)] mb-5 max-w-[52ch] mx-auto">
              No email? Check back any time — approval typically takes a few hours.
            </p>
            <div className="flex items-center gap-2">
              <Link
                href="/account?tab=membership"
                className="btn-primary flex-1 h-11 text-[14px] inline-flex items-center justify-center"
                onClick={close}
              >
                Track my submission
              </Link>
              <button type="button" onClick={close} className="btn-ghost h-11 px-4 text-[14px]">
                Close
              </button>
            </div>
          </div>
        )}
      </div>
    </div>,
    document.body
  )
}
