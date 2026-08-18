"use client"

import { useState, useEffect, useCallback } from "react"
import { createPortal } from "react-dom"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { X, Check, ShieldCheck, Copy, CheckCheck, ArrowLeft } from "lucide-react"
import { PLANS, MEMBER_FEATURE_KEYS, planTitleKey, formatUsd, annualMonthlyEquivalent } from "@/lib/plans"
import { paymentQrUrl } from "@/lib/payment-qr"
import { createOrder, submitPaymentCode } from "@/lib/membership"
import { useI18n } from "@/lib/i18n/LocaleProvider"
import type { MembershipPlan } from "@/lib/plans"
import type { PaymentOrder } from "@/lib/membership"

interface PaymentModalProps {
  plan: MembershipPlan
  onClose: () => void
}

type Step = "loading" | "qr" | "code_input" | "submitted"

/**
 * QR-code payment dialog for a single membership cadence. Monthly and annual
 * unlock the same membership; only the prepaid period differs. After paying
 * by QR, the user taps I've paid and immediately sees the verification-pending
 * message. A site admin verifies the payment in their bank app and approves it
 * on /admin/qr before the membership activates.
 */
const PLAN_FEATURE_KEYS: Record<MembershipPlan, string[]> = {
  pro_monthly: [
    "pricing.features.pro1",
    "pricing.features.pro2",
    "pricing.features.pro3",
    "pricing.features.pro4",
    "pricing.features.pro5",
    "pricing.features.pro6",
  ],
  premium_yearly: [
    "pricing.features.premium1",
    "pricing.features.premium2",
    "pricing.features.premium3",
    "pricing.features.premium4",
  ],
}
export function PaymentModal({ plan, onClose }: PaymentModalProps) {
  const { t } = useI18n()
  const router = useRouter()
  const meta = PLANS[plan]
  const planTitle = t(planTitleKey(plan))
  const isAnnual = plan === "premium_yearly"
  const periodKey = plan === "pro_monthly" ? "payment.monthlyPeriod" : "payment.annualPeriod"

  const [step, setStep] = useState<Step>("loading")
  const [order, setOrder] = useState<PaymentOrder | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  const [copied, setCopied] = useState(false)
  const [code, setCode] = useState("")

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

  useEffect(() => {
    let active = true
    ;(async () => {
      const res = await createOrder(plan)
      if (!active) return
      if (res.order) {
        setOrder(res.order)
        setStep("qr")
      } else if (res.error === "auth") {
        close()
        router.push("/login?returnTo=/pricing")
      } else {
        setError(res.error === "already_member" ? t("payment.alreadyMemberError") : t("membership.tryAgain"))
        setStep("qr")
      }
    })()
    return () => { active = false }
  }, [plan, router, t])

  function close() {
    onClose()
  }

  const handleCopy = useCallback(() => {
    if (!order?.payment_code) return
    navigator.clipboard.writeText(order.payment_code).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }, [order?.payment_code])

  async function handleSubmitCode() {
    const trimmed = code.trim().toUpperCase()
    if (!trimmed) {
      setError(t("payment.errorEnterCode"))
      return
    }
    setBusy(true)
    setError("")
    const res = await submitPaymentCode(trimmed)
    if (res.ok) {
      setStep("submitted")
    } else if (res.error === "invalid_code") {
      setError(t("payment.errorInvalidCode"))
    } else if (res.error === "code_not_yours") {
      setError(t("payment.errorCodeNotYours"))
    } else if (res.error === "already_submitted") {
      setError(t("payment.errorAlreadySubmitted"))
    } else {
      setError(res.error === "auth" ? t("payment.errorEnterCode") : t("membership.tryAgain"))
    }
    setBusy(false)
  }

  return createPortal(
    <div
      className="fixed inset-0 z-[400] bg-[rgba(0,0,0,0.5)] flex items-end sm:items-center justify-center sm:p-4 max-sm:pb-[var(--mobile-nav-offset)]"
      onClick={close}
      role="dialog"
      aria-modal="true"
      aria-label={`${planTitle} ${t("payment.planSuffix")}`}
    >
      <div
        className="w-full sm:max-w-[440px] min-w-0 bg-[var(--surface)] border border-[var(--border)] sm:rounded-[var(--radius)] rounded-t-[var(--radius)] p-4 sm:p-6 md:p-8 text-left shadow-[0_24px_64px_-24px_rgba(0,0,0,0.4)] overflow-y-auto overflow-x-hidden overscroll-contain"
        style={{
          animation: "riseIn 220ms ease-out",
          maxHeight: "min(90dvh, calc(100dvh - var(--mobile-nav-offset)))",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 mb-4">
          <div className="min-w-0">
            <h2 className="font-display text-[18px] font-semibold leading-tight">
              {planTitle} {t("payment.planSuffix")}
            </h2>
            <p className="text-[28px] font-semibold leading-none mt-2">
              {isAnnual ? formatUsd(annualMonthlyEquivalent()) : formatUsd(meta.price)}
              <span className="text-[14px] font-normal text-[var(--text-secondary)]">
                {" "}
                {t("pricing.perMonth")}
              </span>
            </p>
            {isAnnual ? (
              <p className="text-[13px] text-[var(--text-secondary)] mt-2">
                {t("pricing.billedYearly", { yearly: formatUsd(meta.price) })}
              </p>
            ) : null}
            <p className="text-[13px] text-[var(--text-secondary)] mt-2 text-pretty">{t(periodKey)}</p>
          </div>
          <button
            type="button"
            onClick={close}
            className="w-9 h-9 shrink-0 flex items-center justify-center rounded-[var(--radius-sm)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-alt)]"
            aria-label={t("payment.closeDialog")}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {step === "loading" && (
          <div className="py-10 text-center text-[14px] text-[var(--text-secondary)]">
            {t("payment.confirming")}
          </div>
        )}

        {step === "qr" && order && (
          <>
            <a
              href={paymentQrUrl(plan)}
              target="_blank"
              rel="noopener noreferrer"
              className="block w-full max-w-[min(280px,100%)] aspect-square mx-auto mb-5 bg-[var(--surface)] p-2 transition-opacity hover:opacity-80"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={paymentQrUrl(plan)}
                alt={`KHQR payment for ${planTitle} ${t("payment.planSuffix")}`}
                className="w-full h-full object-contain"
              />
            </a>

            <div className="text-center mb-4">
              <p className="text-[14px] text-[var(--text-secondary)] mb-1">{t("payment.scanHint")}</p>
              <p className="text-[13px] text-[var(--text-secondary)]">{t("payment.abaPayee")}</p>
              <p className="text-[13px] text-[var(--text-secondary)] mt-1">
                {t("payment.payExactly")}{" "}
                <span className="font-semibold text-[var(--text-primary)]">{formatUsd(meta.price)}</span>
              </p>
            </div>

            <div className="bg-[var(--surface-alt)] border border-[var(--border)] rounded-[var(--radius-sm)] p-4 mb-4">
              <p className="text-[12px] font-semibold uppercase tracking-wide text-[var(--text-secondary)] mb-2">
                {t("payment.yourPaymentCode")}
              </p>
              <div className="flex items-center gap-2">
                <code className="flex-1 text-[18px] font-mono font-bold tracking-wider text-[var(--text-primary)] bg-[var(--surface)] border border-[var(--border)] rounded px-3 py-2 text-center">
                  {order.payment_code}
                </code>
                <button
                  type="button"
                  onClick={handleCopy}
                  className="shrink-0 w-10 h-10 flex items-center justify-center rounded-[var(--radius-sm)] border border-[var(--border)] hover:bg-[var(--surface-alt)] transition-colors"
                  aria-label="Copy payment code"
                >
                  {copied ? <CheckCheck className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4 text-[var(--text-secondary)]" />}
                </button>
              </div>
              {copied && (
                <p className="mt-1.5 text-[12px] text-green-600 font-semibold">Copied to clipboard!</p>
              )}
            </div>

            <div className="bg-[var(--surface-alt)] border border-[var(--border)] rounded-[var(--radius-sm)] p-4 mb-4 text-[13px] text-[var(--text-secondary)] space-y-1.5">
              <p className="font-semibold text-[var(--text-primary)] mb-2">{t("payment.instructions")}</p>
              <p>1. {t("payment.instruction1")}</p>
              <p>2. {t("payment.instruction2")}</p>
              <p>3. {t("payment.instruction3")}</p>
              <p>4. {t("payment.instruction4")}</p>
            </div>

            {error && (
              <p
                className="mb-4 p-3 rounded-[var(--radius-sm)] bg-[var(--red-subtle-bg)] text-[13px] font-semibold text-[var(--accent)]"
                role="alert"
              >
                {error}
              </p>
            )}

            <button
              type="button"
              onClick={() => setStep("code_input")}
              className="btn-primary w-full h-11 text-[14px]"
            >
              {t("payment.iHavePaid")}
            </button>
          </>
        )}

        {step === "code_input" && (
          <>
            <button
              type="button"
              onClick={() => { setStep("qr"); setError(""); setCode("") }}
              className="flex items-center gap-1.5 text-[13px] text-[var(--text-secondary)] hover:text-[var(--text-primary)] mb-4"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              {t("payment.backToQr")}
            </button>

            <h3 className="font-display text-[16px] font-semibold mb-2">{t("payment.enterPaymentCode")}</h3>
            <p className="text-[13px] text-[var(--text-secondary)] mb-4">
              {t("payment.enterCodeInstructions")}
            </p>

            <div className="mb-4">
              <label className="meta-text block mb-1.5">{t("payment.paymentCodeLabel")}</label>
              <input
                type="text"
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                placeholder="PAY-XXXXXXXX"
                className="w-full h-11 px-3 rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--surface)] text-[16px] font-mono font-bold tracking-wider text-center text-[var(--text-primary)] placeholder:text-[var(--text-secondary)] placeholder:font-normal placeholder:tracking-normal focus:outline-none focus:border-[var(--accent)]"
                autoFocus
              />
            </div>

            {error && (
              <p
                className="mb-4 p-3 rounded-[var(--radius-sm)] bg-[var(--red-subtle-bg)] text-[13px] font-semibold text-[var(--accent)]"
                role="alert"
              >
                {error}
              </p>
            )}

            <button
              type="button"
              onClick={handleSubmitCode}
              disabled={busy || !code.trim()}
              className="btn-primary w-full h-11 text-[14px] disabled:opacity-50"
            >
              {busy ? t("payment.submitting") : t("payment.submitCode")}
            </button>
          </>
        )}

        {step === "submitted" && (
          <div>
            <div className="mx-auto mb-4 w-14 h-14 rounded-full flex items-center justify-center bg-[var(--red-subtle-bg)]">
              <ShieldCheck className="h-7 w-7 text-[var(--accent)]" />
            </div>

            <div className="text-center text-[12px] font-semibold uppercase tracking-wide text-[var(--accent)] mb-3">
              {t("payment.paymentSubmitted")}
            </div>

            <p className="text-center text-[14px] text-[var(--text-secondary)] mb-2 max-w-[52ch] mx-auto">
              {t("payment.yourPaymentOf")}{" "}
              <span className="font-semibold text-[var(--text-primary)]">
                {formatUsd(meta.price)}
              </span>{" "}
              {t("payment.recordedNote")}
            </p>

            <p className="text-center text-[13px] text-[var(--text-secondary)] mb-5 max-w-[52ch] mx-auto">
              {t(periodKey)}
            </p>

            <div className="text-left bg-[var(--surface-alt)] border border-[var(--border)] rounded-[var(--radius-sm)] p-4 mb-5">
              <p className="text-[12px] font-semibold uppercase tracking-wide text-[var(--text-secondary)] mb-2">
                {t("payment.whatYouGet")}
              </p>
              <ul className="space-y-2 text-[14px] text-[var(--text-primary)]">
                {MEMBER_FEATURE_KEYS.map((k) => (
                  <li key={k} className="flex items-start gap-2 min-w-0">
                    <Check className="h-4 w-4 shrink-0 mt-0.5 text-[var(--accent)]" />
                    <span className="min-w-0 text-pretty">{t(k)}</span>
                  </li>
                ))}
              </ul>
            </div>

            <p className="text-center text-[13px] text-[var(--text-secondary)] mb-5 max-w-[52ch] mx-auto">
              {t("payment.planActivatedAfterReview")}
            </p>
            <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center gap-2">
              <Link
                href="/account?tab=membership"
                className="btn-primary w-full sm:flex-1 min-h-11 text-[14px] inline-flex items-center justify-center"
                onClick={close}
              >
                {t("payment.trackSubmission")}
              </Link>
              <button type="button" onClick={close} className="btn-ghost w-full sm:w-auto min-h-11 px-4 text-[14px]">
                {t("payment.close")}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>,
    document.body
  )
}
