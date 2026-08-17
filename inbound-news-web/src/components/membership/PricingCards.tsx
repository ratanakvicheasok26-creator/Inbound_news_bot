"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Check, Sparkles } from "lucide-react"
import { useMembership, subscribe, openBillingPortal } from "@/lib/membership"
import { PLANS, priceLabel, isActiveMembership, type MembershipPlan } from "@/lib/plans"
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

const PRO_FEATURE_KEYS = [
  "pricing.features.pro1",
  "pricing.features.pro2",
  "pricing.features.pro3",
  "pricing.features.pro4",
  "pricing.features.pro5",
  "pricing.features.pro6",
]

const PREMIUM_FEATURE_KEYS = [
  "pricing.features.premium1",
  "pricing.features.premium2",
  "pricing.features.premium3",
  "pricing.features.premium4",
]

export function PricingCards() {
  const { t } = useI18n()
  const router = useRouter()
  const { membership } = useMembership()
  const member = isActiveMembership(membership)
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
      <div className="grid gap-6 lg:grid-cols-3 items-stretch">
        {/* Free */}
        <div className="flex flex-col bg-[var(--surface)] border border-[var(--border)] rounded-[var(--radius)] p-6">
          <h3 className="font-display text-[18px] font-semibold mb-1">{t("membership.free")}</h3>
          <p className="text-[28px] font-semibold leading-none mb-4">
            $0<span className="text-[14px] font-normal text-[var(--text-secondary)]"> {t("membership.forever")}</span>
          </p>
          <p className="text-[13px] text-[var(--text-secondary)] mb-5">
            {t("membership.freeDescription")}
          </p>
          <ul className="space-y-2.5 mb-6 text-[14px] text-[var(--text-primary)]">
            {FREE_FEATURE_KEYS.map((k) => (
              <li key={k} className="flex items-start gap-2">
                <Check className="h-4 w-4 shrink-0 mt-0.5 text-[var(--accent)]" />
                {t(k)}
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
                {t("membership.currentPlan")}
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

        {/* Paid tiers */}
        {TIER_ORDER.map((plan, idx) => {
          const meta = PLANS[plan]
          const current = member && membership?.plan === plan
          const featureKeys = plan === "pro_monthly" ? PRO_FEATURE_KEYS : PREMIUM_FEATURE_KEYS
          return (
            <div
              key={plan}
              className={`relative flex flex-col bg-[var(--surface)] border rounded-[var(--radius)] p-6 ${
                idx === 0
                  ? "border-[var(--accent)] shadow-[0_0_0_1px_var(--accent)]"
                  : "border-[var(--border)]"
              }`}
            >
              <div className="flex items-center gap-2 mb-1">
                <h3 className="font-display text-[18px] font-semibold">{meta.name}</h3>
                {idx === 0 && (
                  <span className="inline-flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wide text-[var(--accent)] bg-[var(--red-subtle-bg)] rounded-full px-2 py-0.5">
                    <Sparkles className="h-3 w-3" />
                    {t("membership.popular")}
                  </span>
                )}
              </div>
              <p className="text-[28px] font-semibold leading-none mb-1">{priceLabel(plan)}</p>
              <p className="text-[13px] text-[var(--text-secondary)] mb-5">
                {t(plan === "pro_monthly" ? "pricing.proTagline" : "pricing.premiumTagline")}
              </p>
              <ul className="space-y-2.5 mb-6 text-[14px] text-[var(--text-primary)]">
                {featureKeys.map((k) => (
                  <li key={k} className="flex items-start gap-2">
                    <Check className="h-4 w-4 shrink-0 mt-0.5 text-[var(--accent)]" />
                    {t(k)}
                  </li>
                ))}
              </ul>
              <div className="mt-auto space-y-2">
                {current ? (
                  <button
                    type="button"
                    onClick={handlePortal}
                    disabled={busy !== null}
                    className="w-full btn-ghost text-[14px]"
                  >
                    {t("membership.manageBilling")}
                  </button>
                ) : member ? (
                  <button
                    type="button"
                    onClick={() => setQrPlan(plan)}
                    disabled={busy !== null}
                    className={`w-full text-[14px] ${
                      idx === 0 ? "btn-primary" : "btn-ghost"
                    } disabled:opacity-60`}
                  >
                    {t("membership.switchPlan")} {meta.name}
                  </button>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={() => setQrPlan(plan)}
                      className={`w-full text-[14px] ${
                        idx === 0 ? "btn-primary" : "btn-ghost"
                      }`}
                    >
                      {t("membership.payByQr")} {meta.name}
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
