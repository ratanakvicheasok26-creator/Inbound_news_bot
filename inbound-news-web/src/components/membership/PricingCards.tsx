"use client"

import { useState, useRef } from "react"
import { useRouter } from "next/navigation"
import { motion, AnimatePresence } from "framer-motion"
import { Check, Sparkles } from "lucide-react"
import NumberFlow from "@number-flow/react"
import confetti from "canvas-confetti"
import { useMembership, useEntitlement, subscribe, openBillingPortal } from "@/lib/membership"
import {
  isActiveMembership,
  hasStripeBilling,
  type MembershipPlan,
} from "@/lib/plans"
import { PaymentModal } from "@/components/membership/PaymentModal"
import { useI18n } from "@/lib/i18n/LocaleProvider"
import { InteractiveStarfield } from "@/components/ui/pricing"

const FREE_FEATURE_KEYS = [
  "pricing.features.free1",
  "pricing.features.free2",
  "pricing.features.free2b",
  "pricing.features.free3",
  "pricing.features.free4",
  "pricing.features.free5",
]

const PAID_FEATURE_KEYS = [
  "pricing.features.member1",
  "pricing.features.member2",
  "pricing.features.member3",
  "pricing.features.member4",
  "pricing.features.member5",
  "pricing.features.member6",
]

export function PricingCards() {
  const { t } = useI18n()
  const router = useRouter()
  const { membership } = useMembership()
  const { entitlement } = useEntitlement()
  const member = isActiveMembership(membership)
  const stripeBilled = hasStripeBilling(membership)
  const isTrialUser = entitlement.tier === "PRO_TRIAL"

  const [isMonthly, setIsMonthly] = useState(true)
  const [busy, setBusy] = useState<MembershipPlan | null>(null)
  const [error, setError] = useState("")
  const [qrPlan, setQrPlan] = useState<MembershipPlan | null>(null)
  const [freeChosen, setFreeChosen] = useState(false)

  const toggleRef = useRef<HTMLDivElement>(null)

  const handleToggle = (monthly: boolean) => {
    if (isMonthly === monthly) return
    setIsMonthly(monthly)

    if (!monthly && toggleRef.current) {
      const rect = toggleRef.current.getBoundingClientRect()
      const originX = (rect.left + rect.width * 0.75) / window.innerWidth
      const originY = (rect.top + rect.height / 2) / window.innerHeight

      confetti({
        particleCount: 50,
        spread: 60,
        origin: { x: originX, y: originY },
        colors: ["#FF0030", "#FFFFFF", "#2563EB", "#0F766E"],
        ticks: 200,
        gravity: 1.1,
        decay: 0.94,
        startVelocity: 25,
      })
    }
  }

  async function handleSubscribe(plan: MembershipPlan) {
    setBusy(plan)
    setError("")
    const res = await subscribe(plan)
    if ("url" in res) {
      window.location.assign(res.url)
      return
    }
    if (res.error === "auth") {
      router.push("/login?returnTo=/pricing")
      return
    }
    setError(
      res.error === "configured"
        ? t("membership.paymentsSetup")
        : res.error === "already"
          ? t("membership.alreadyMember")
          : t("membership.tryAgain"),
    )
    setBusy(null)
  }

  async function handlePortal() {
    setError("")
    const url = await openBillingPortal()
    if (url) {
      window.location.assign(url)
    } else {
      setError(t("membership.billingError"))
    }
  }

  const targetPlan: MembershipPlan = isMonthly ? "pro_monthly" : "premium_yearly"
  const isCurrentPlan = member && membership?.plan === targetPlan
  const isOtherPaid = member && membership?.plan !== targetPlan
  const activeFeatures = PAID_FEATURE_KEYS

  return (
    <div className="relative w-full overflow-hidden rounded-2xl py-4 sm:py-6">
      <InteractiveStarfield />

      {/* Trial Status Banner */}
      {isTrialUser && (
        <div className="relative z-10 max-w-4xl mx-auto mb-6 sm:mb-8 p-5 rounded-2xl bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-transparent border border-amber-500/20">
          <div className="flex items-center gap-3">
            <span className="text-2xl">🎁</span>
            <div>
              <h4 className="text-base font-semibold text-[var(--text-primary)]">
                {t("membership.trialBannerTitle")}
              </h4>
              <p className="text-sm text-[var(--text-secondary)] mt-0.5">
                {t("membership.trialBannerSubtitle")} — {entitlement.daysRemaining} {t("trial.daysRemaining")}
              </p>
              <p className="text-xs text-[var(--text-secondary)]/80 mt-1">
                {t("membership.noPaymentRequired")}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Monthly / Annual Toggle */}
      <div className="relative z-10 flex justify-center mb-6 sm:mb-10 md:mb-12">
        <div
          ref={toggleRef}
          className="relative inline-flex items-center rounded-full bg-[var(--surface-alt)] border border-[var(--border)] p-1 shadow-inner max-w-full"
        >
          <button
            type="button"
            onClick={() => handleToggle(true)}
            className={`relative rounded-full px-3.5 sm:px-6 py-1.5 sm:py-2 text-[11px] sm:text-sm font-semibold transition-colors duration-200 cursor-pointer ${
              isMonthly ? "text-[var(--text-primary)]" : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
            }`}
          >
            {isMonthly && (
              <motion.div
                layoutId="pricing-active-pill"
                className="absolute inset-0 rounded-full bg-[var(--surface)] shadow-md border border-[var(--border)]"
                transition={{ type: "spring", stiffness: 500, damping: 35 }}
              />
            )}
            <span className="relative z-10">{t("pricing.monthlyTitle")}</span>
          </button>

          <button
            type="button"
            onClick={() => handleToggle(false)}
            className={`relative rounded-full px-3.5 sm:px-6 py-1.5 sm:py-2 text-[11px] sm:text-sm font-semibold transition-colors duration-200 cursor-pointer ${
              !isMonthly ? "text-[var(--text-primary)]" : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
            }`}
          >
            {!isMonthly && (
              <motion.div
                layoutId="pricing-active-pill"
                className="absolute inset-0 rounded-full bg-[var(--surface)] shadow-md border border-[var(--border)]"
                transition={{ type: "spring", stiffness: 500, damping: 35 }}
              />
            )}
            <span className="relative z-10 flex items-center gap-1 sm:gap-1.5">
              {t("pricing.annualTitle")}
              <span
                className={`text-[10px] sm:text-xs font-bold text-[#FF0030]`}
              >
                ({t("pricing.savePercentage", { percent: "48" })})
              </span>
            </span>
          </button>
        </div>
      </div>

      {/* 2-Card Layout (Free on Left, Paid Pro/Premium on Right) */}
      <div className="relative z-10 max-w-4xl mx-auto grid gap-6 sm:gap-8 grid-cols-1 md:grid-cols-2 items-stretch">
        {/* 1. FREE PLAN */}
        <div className="animate-card-in flex min-w-0 flex-col bg-[var(--surface)]/90 backdrop-blur-md border border-[var(--border)] rounded-2xl p-5 sm:p-6 md:p-8 transition-all duration-200 hover:border-[var(--text-secondary)] shadow-sm">
          <div className="flex-1 flex flex-col">
            <div>
              <h3 className="font-display text-xl sm:text-2xl font-bold text-[var(--text-primary)] mb-1">
                {t("membership.free")}
              </h3>
              <div className="flex items-baseline gap-1.5 mt-2 sm:mt-3 mb-1">
                <span className="text-3xl sm:text-4xl md:text-5xl font-extrabold tracking-tight text-[var(--text-primary)]">
                  $0
                </span>
                <span className="text-xs sm:text-sm font-normal text-[var(--text-secondary)]">
                  {t("membership.forever")}
                </span>
              </div>
              <p className="text-xs sm:text-sm text-[var(--text-secondary)] mt-2 mb-4 sm:mb-6 min-h-[32px] sm:min-h-[38px]">
                {t("membership.freeDescription")}
              </p>
            </div>

            <ul className="space-y-3.5 mb-8 text-xs sm:text-sm text-[var(--text-primary)]">
              {FREE_FEATURE_KEYS.map((key) => (
                <li key={key} className="flex items-start gap-2.5 min-w-0">
                  <Check className="h-4 w-4 shrink-0 mt-0.5 text-[#FF0030]" />
                  <span className="min-w-0 text-pretty leading-snug">{t(key)}</span>
                </li>
              ))}
            </ul>

            <div className="mt-auto pt-2">
              {freeChosen ? (
                <button
                  type="button"
                  disabled
                  className="w-full h-11 rounded-xl bg-[#FF0030] text-white text-sm font-semibold disabled:opacity-60"
                >
                  {t("membership.freeConfirmed")}
                </button>
              ) : member ? (
                <button
                  type="button"
                  disabled
                  className="w-full h-11 rounded-xl bg-[var(--surface-alt)] border border-[var(--border)] text-[var(--text-secondary)] text-sm font-semibold disabled:opacity-60"
                >
                  {t("membership.youHaveMembership")}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setFreeChosen(true)}
                  className="w-full h-11 rounded-xl bg-[var(--surface-alt)] border border-[var(--border)] hover:bg-[var(--border)] text-[var(--text-primary)] text-sm font-semibold transition-colors cursor-pointer"
                >
                  {t("membership.chooseFree")}
                </button>
              )}
              {freeChosen && (
                <p className="mt-3 text-xs text-[var(--text-secondary)] text-center">
                  {t("membership.youAreFree")}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* 2. PAID PLAN (Pro) */}
        <div className="animate-card-in-delayed relative flex min-w-0 flex-col rounded-2xl p-5 sm:p-6 md:p-8 bg-[var(--surface)]/95 backdrop-blur-md border-2 border-[#FF0030] shadow-xl shadow-[#FF0030]/10 transition-all duration-200">
          {/* POPULAR Badge */}
          <div className="absolute top-0 -translate-y-1/2 left-1/2 -translate-x-1/2 z-20">
            <div className="bg-[#FF0030] py-1 px-3 sm:px-4 rounded-full flex items-center gap-1.5 shadow-md">
              <Sparkles className="text-white h-3 sm:h-3.5 w-3 sm:w-3.5 fill-current" />
              <span className="text-white text-[10px] sm:text-xs font-bold uppercase tracking-wider">
                {t("pricing.popular")}
              </span>
            </div>
          </div>

          <div className="flex-1 flex flex-col">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <h3 className="font-display text-xl sm:text-2xl font-bold text-[var(--text-primary)] transition-all duration-200">
                  Pro
                </h3>
              </div>

              <div className="flex items-baseline gap-1 mt-2 sm:mt-3 mb-1">
                <span className="text-3xl sm:text-4xl md:text-5xl font-extrabold tracking-tight text-[var(--text-primary)]">
                  <NumberFlow
                    value={isMonthly ? 7.99 : 49.99}
                    format={{
                    style: "currency",
                    currency: "USD",
                    minimumFractionDigits: 2,
                  }}
                    className="font-variant-numeric: tabular-nums"
                  />
                </span>
                <span className="text-xs sm:text-sm font-medium text-[var(--text-secondary)]">
                  {isMonthly ? t("pricing.perMonth") : t("pricing.perYear")}
                </span>
              </div>

              <p className="text-xs sm:text-sm text-[var(--text-secondary)] mt-2 mb-4 sm:mb-6 min-h-[32px] sm:min-h-[38px] transition-all duration-200">
                {t("pricing.proTagline")}
              </p>
            </div>

            {/* Dynamic Perks list with smooth transition */}
            <div className="min-h-[220px] mb-8">
              <AnimatePresence mode="wait">
                <motion.ul
                  key={isMonthly ? "pro-perks" : "premium-perks"}
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  transition={{ duration: 0.18 }}
                  className="space-y-3.5 text-xs sm:text-sm text-[var(--text-primary)]"
                >
                  {activeFeatures.map((key) => (
                    <li key={key} className="flex items-start gap-2.5 min-w-0">
                      <Check className="h-4 w-4 shrink-0 mt-0.5 text-[#FF0030]" />
                      <span className="min-w-0 text-pretty leading-snug">{t(key)}</span>
                    </li>
                  ))}
                </motion.ul>
              </AnimatePresence>
            </div>

            <div className="mt-auto pt-2 space-y-2.5">
              {isCurrentPlan ? (
                stripeBilled ? (
                  <button
                    type="button"
                    onClick={handlePortal}
                    disabled={busy !== null}
                    className="w-full h-11 rounded-xl bg-[var(--surface-alt)] border border-[var(--border)] hover:bg-[var(--border)] text-[var(--text-primary)] text-sm font-semibold transition-colors cursor-pointer"
                  >
                    {t("membership.manageBilling")}
                  </button>
                ) : (
                  <button
                    type="button"
                    disabled
                    className="w-full h-11 rounded-xl bg-[#FF0030] text-white text-sm font-semibold disabled:opacity-60"
                  >
                    {t("membership.currentPlan")}
                  </button>
                )
              ) : isOtherPaid ? (
                <p className="text-xs text-[var(--text-secondary)] text-center leading-snug py-2">
                  {t("membership.switchAfterPeriod")}
                </p>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => setQrPlan(targetPlan)}
                    className="w-full h-11 rounded-xl bg-[#FF0030] hover:bg-[#FF0030]/90 text-white text-sm font-semibold shadow-md shadow-[#FF0030]/20 transition-all cursor-pointer"
                  >
                    {t("membership.payByQr")} Pro
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSubscribe(targetPlan)}
                    disabled={busy !== null}
                    className="w-full text-xs font-semibold text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors disabled:opacity-60 cursor-pointer text-center py-1"
                  >
                    {busy === targetPlan
                      ? t("membership.openingCheckout")
                      : t("membership.payWithCard")}
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {error && (
        <p
          className="mt-6 max-w-4xl mx-auto p-4 rounded-xl bg-[#FF0030]/10 border border-[#FF0030]/20 text-sm font-medium text-[#FF0030] text-center"
          role="alert"
        >
          {error}
        </p>
      )}

      {qrPlan && <PaymentModal plan={qrPlan} onClose={() => setQrPlan(null)} />}
    </div>
  )
}
