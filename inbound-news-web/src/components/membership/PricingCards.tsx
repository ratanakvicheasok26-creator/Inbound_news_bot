"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Check, Sparkles } from "lucide-react"
import { useMembership, subscribe, openBillingPortal } from "@/lib/membership"
import {
  PLANS,
  formatUsd,
  isActiveMembership,
  hasStripeBilling,
  MEMBER_FEATURE_KEYS,
  planTitleKey,
  planTaglineKey,
  annualMonthlyEquivalent,
  annualSavingsVsMonthly,
  annualMonthsFree,
  yearlyIfPaidMonthly,
  type MembershipPlan,
} from "@/lib/plans"
import { PaymentModal } from "@/components/membership/PaymentModal"
import { useI18n } from "@/lib/i18n/LocaleProvider"

const TIER_ORDER: MembershipPlan[] = ["pro_monthly", "premium_yearly"]

const FREE_FEATURE_KEYS = [
  "pricing.features.free1",
  "pricing.features.free2",
  "pricing.features.free3",
  "pricing.features.free4",
  "pricing.features.free5",
]

export function PricingCards() {
  const { t } = useI18n()
  const router = useRouter()
  const { membership } = useMembership()
  const member = isActiveMembership(membership)
  const stripeBilled = hasStripeBilling(membership)
  const [busy, setBusy] = useState<MembershipPlan | null>(null)
  const [error, setError] = useState("")
  const [qrPlan, setQrPlan] = useState<MembershipPlan | null>(null)
  const [freeChosen, setFreeChosen] = useState(false)

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

  return (
    <div>
      <div className="grid gap-4 sm:gap-6 md:grid-cols-2 xl:grid-cols-3 items-stretch">
        {/* Free — last on phones (Annual first), first on desktop */}
        <div className="order-3 xl:order-1 flex min-w-0 flex-col bg-[var(--surface)] border border-[var(--border)] rounded-[var(--radius)] p-4 sm:p-6 md:col-span-2 xl:col-span-1">
          <h3 className="font-display text-[18px] font-semibold mb-1">{t("membership.free")}</h3>
          <p className="text-[28px] font-semibold leading-none mb-4">
            $0<span className="text-[14px] font-normal text-[var(--text-secondary)]"> {t("membership.forever")}</span>
          </p>
          <p className="text-[13px] text-[var(--text-secondary)] mb-5">
            {t("membership.freeDescription")}
          </p>
          <ul className="space-y-2.5 mb-6 text-[14px] text-[var(--text-primary)]">
            {FREE_FEATURE_KEYS.map((k) => (
              <li key={k} className="flex items-start gap-2 min-w-0">
                <Check className="h-4 w-4 shrink-0 mt-0.5 text-[var(--accent)]" />
                <span className="min-w-0 text-pretty">{t(k)}</span>
              </li>
            ))}
          </ul>
          <div className="mt-auto">
            {freeChosen ? (
              <button
                type="button"
                disabled
                className="w-full btn-primary text-[14px] disabled:opacity-50"
              >
                {t("membership.freeConfirmed")}
              </button>
            ) : member ? (
              <button
                type="button"
                disabled
                className="w-full btn-ghost text-[14px] disabled:opacity-50"
              >
                {t("membership.youHaveMembership")}
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setFreeChosen(true)}
                className="w-full btn-ghost text-[14px]"
              >
                {t("membership.chooseFree")}
              </button>
            )}
            {freeChosen && (
              <p className="mt-3 text-[13px] text-[var(--text-secondary)] text-center">
                {t("membership.youAreFree")}
              </p>
            )}
          </div>
        </div>

        {/* Paid cadences — same membership, two billing periods */}
        {TIER_ORDER.map((plan) => {
          const meta = PLANS[plan]
          const current = member && membership?.plan === plan
          const otherPaid = member && membership?.plan !== plan
          const highlighted = plan === "premium_yearly"
          return (
            <div
              key={plan}
              className={`relative flex min-w-0 flex-col bg-[var(--surface)] border rounded-[var(--radius)] p-4 sm:p-6 ${
                highlighted
                  ? "order-1 xl:order-3 border-[var(--accent)] shadow-[0_0_0_1px_var(--accent)]"
                  : "order-2 xl:order-2 border-[var(--border)]"
              }`}
            >
              <div className="flex flex-wrap items-center gap-2 mb-1">
                <h3 className="font-display text-[18px] font-semibold">{t(planTitleKey(plan))}</h3>
                {highlighted && (
                  <span className="inline-flex items-center gap-1 shrink-0 text-[11px] font-semibold uppercase tracking-wide text-[var(--accent)] bg-[var(--red-subtle-bg)] rounded-full px-2 py-0.5">
                    <Sparkles className="h-3 w-3" />
                    {t("membership.bestValue")}
                  </span>
                )}
              </div>
              <p className="text-[26px] sm:text-[28px] font-semibold leading-none mb-1">
                {highlighted ? (
                  <>
                    {formatUsd(annualMonthlyEquivalent())}
                    <span className="text-[14px] font-normal text-[var(--text-secondary)]">
                      {" "}
                      {t("pricing.perMonth")}
                    </span>
                  </>
                ) : (
                  <>
                    {formatUsd(meta.price)}
                    <span className="text-[14px] font-normal text-[var(--text-secondary)]">
                      {" "}
                      {t("pricing.perMonth")}
                    </span>
                  </>
                )}
              </p>
              {highlighted ? (
                <>
                  <p className="text-[13px] text-[var(--text-secondary)] mb-1">
                    {t("pricing.billedYearly", { yearly: formatUsd(meta.price) })}
                  </p>
                  <p className="text-[13px] font-semibold text-[var(--accent)] mb-1 leading-snug text-pretty">
                    <s className="font-normal text-[var(--text-secondary)] mr-1.5">
                      {formatUsd(yearlyIfPaidMonthly())}
                    </s>
                    {t("pricing.annualDeal", {
                      savings: formatUsd(annualSavingsVsMonthly()),
                      months: annualMonthsFree(),
                    })}
                  </p>
                </>
              ) : (
                <p className="text-[13px] text-[var(--text-secondary)] mb-1">
                  {t("pricing.monthlyYearlyHint", { yearly: formatUsd(yearlyIfPaidMonthly()) })}
                </p>
              )}
              <p className="text-[13px] text-[var(--text-secondary)] mb-5 text-pretty">
                {t(planTaglineKey(plan))}
              </p>
              <ul className="space-y-2.5 mb-6 text-[14px] text-[var(--text-primary)]">
                {MEMBER_FEATURE_KEYS.map((k) => (
                  <li key={k} className="flex items-start gap-2 min-w-0">
                    <Check className="h-4 w-4 shrink-0 mt-0.5 text-[var(--accent)]" />
                    <span className="min-w-0 text-pretty">{t(k)}</span>
                  </li>
                ))}
              </ul>
              <div className="mt-auto space-y-2">
                {current ? (
                  stripeBilled ? (
                    <button
                      type="button"
                      onClick={handlePortal}
                      disabled={busy !== null}
                      className="w-full btn-ghost text-[14px]"
                    >
                      {t("membership.manageBilling")}
                    </button>
                  ) : (
                    <button
                      type="button"
                      disabled
                      className="w-full btn-primary text-[14px] disabled:opacity-50"
                    >
                      {t("membership.currentPlan")}
                    </button>
                  )
                ) : otherPaid ? (
                  <p className="text-[13px] text-[var(--text-secondary)] text-center leading-snug">
                    {t("membership.switchAfterPeriod")}
                  </p>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={() => setQrPlan(plan)}
                      className={`w-full text-[14px] ${
                        highlighted ? "btn-primary" : "btn-ghost"
                      }`}
                    >
                      {t("membership.payByQr")} {t(planTitleKey(plan))}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleSubscribe(plan)}
                      disabled={busy !== null}
                      className="w-full text-[13px] font-semibold text-[var(--text-secondary)] hover:text-[var(--accent)] disabled:opacity-60"
                    >
                      {busy === plan ? t("membership.openingCheckout") : t("membership.payWithCard")}
                    </button>
                  </>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {error && (
        <p
          className="mt-5 p-3 rounded-[var(--radius-sm)] bg-[var(--red-subtle-bg)] text-[13px] font-semibold text-[var(--accent)] text-center"
          role="alert"
        >
          {error}
        </p>
      )}

      {qrPlan && <PaymentModal plan={qrPlan} onClose={() => setQrPlan(null)} />}
    </div>
  )
}
