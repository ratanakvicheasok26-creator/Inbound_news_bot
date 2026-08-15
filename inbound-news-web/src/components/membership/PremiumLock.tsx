"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Lock } from "lucide-react"
import { subscribe } from "@/lib/membership"
import { useI18n } from "@/lib/i18n/LocaleProvider"
import { PaymentModal } from "@/components/membership/PaymentModal"

export function PremiumLock({ teaser }: { teaser?: string | null }) {
  const { t } = useI18n()
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  const [qrOpen, setQrOpen] = useState(false)

  async function handleJoin() {
    setBusy(true)
    setError("")
    const res = await subscribe("pro_monthly")
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
        <span className="meta-text font-semibold text-[var(--accent)]">{t("membership.proOnly")}</span>
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

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => setQrOpen(true)}
          className="btn-primary text-[14px] px-5"
        >
          {t("membership.payByQrMonthly")}
        </button>
        <Link href="/pricing" className="btn-ghost text-[14px] px-5">
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

      {qrOpen && <PaymentModal plan="pro_monthly" onClose={() => setQrOpen(false)} />}
    </div>
  )
}
