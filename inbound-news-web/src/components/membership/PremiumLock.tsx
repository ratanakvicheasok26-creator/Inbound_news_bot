"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Lock } from "lucide-react"
import { PLANS, annualMonthlyEquivalent, formatUsd, type MembershipPlan } from "@/lib/plans"
import { subscribe } from "@/lib/membership"
import { useI18n } from "@/lib/i18n/LocaleProvider"
import { PaymentModal } from "@/components/membership/PaymentModal"
import type { Feature } from "@/lib/access"
import { requiredTier } from "@/lib/access"
import type { MembershipPlan } from "@/lib/stripe"

function planForFeature(feature: Feature): MembershipPlan {
  return requiredTier(feature) === "premium" ? "premium_yearly" : "pro_monthly"
}

export function PremiumLock({ feature, teaser }: { feature?: Feature; teaser?: string | null }) {
  const { t } = useI18n()
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  const [qrPlan, setQrPlan] = useState<MembershipPlan | null>(null)
  const plan = feature ? planForFeature(feature) : "pro_monthly"

  async function handleJoin() {
    setBusy(true)
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
          ? t("membership.allSet")
          : t("membership.tryAgain"),
    )
    setBusy(false)
  }

  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        <Lock className="h-4 w-4 text-[var(--accent)]" />
        <span className="meta-text font-semibold text-[var(--accent)]">{t("membership.membersOnlyBadge")}</span>
      </div>

      {teaser && (
        <p className="text-[17px] sm:text-[18px] leading-[1.65] text-[var(--text-primary)] mb-4 max-w-[65ch]">
          {teaser}
          <span className="text-[var(--text-secondary)]">…</span>
        </p>
      )}

      <p className="text-[14px] text-[var(--text-secondary)] mb-5 max-w-[58ch]">
        {t("membership.storyForMembers")}
      </p>

      <div className="flex flex-col sm:flex-row sm:flex-wrap items-stretch sm:items-center gap-2 sm:gap-3">
        <button
          type="button"
          onClick={() => setQrPlan("premium_yearly")}
          className="btn-primary w-full sm:w-auto text-[14px] px-5"
        >
          {t("membership.joinFrom", { price: formatUsd(annualMonthlyEquivalent()) })}
        </button>
        <button
          type="button"
          onClick={() => setQrPlan("pro_monthly")}
          className="btn-ghost w-full sm:w-auto text-[14px] px-5"
        >
          {t("membership.payByQrMonthly", { price: formatUsd(PLANS.pro_monthly.price) })}
        </button>
        <Link href="/pricing" className="btn-ghost w-full sm:w-auto text-[14px] px-5">
          {t("membership.viewPlans")}
        </Link>
      </div>

      <p className="mt-3 text-[13px] text-[var(--text-secondary)]">
        {t("membership.preferCard")}{" "}
        <button
          type="button"
          onClick={handleJoin}
          disabled={busy}
          className="font-semibold text-[var(--accent)] hover:text-[var(--accent-hover)] disabled:opacity-60"
        >
          {busy ? t("membership.openingCheckout") : t("membership.payWithStripe")}
        </button>
      </p>

      {error && (
        <p
          className="mt-4 p-3 rounded-[var(--radius-sm)] bg-[var(--red-subtle-bg)] text-[13px] font-semibold text-[var(--accent)]"
          role="alert"
        >
          {error}
        </p>
      )}

      {qrPlan && <PaymentModal plan={qrPlan} onClose={() => setQrPlan(null)} />}
    </div>
  )
}
