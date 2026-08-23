"use client"

import { useEffect, useState } from "react"
import { Smartphone } from "lucide-react"
import { getPaywayStatus, type PaywayCheckout, type PaywayTransaction } from "@/lib/membership"
import { useI18n } from "@/lib/i18n/LocaleProvider"

type Props = {
  transaction: PaywayTransaction
  checkout: PaywayCheckout
  onPaid: () => void
  onFailed: (message: string) => void
}

export function PaywayPanel({ transaction, checkout, onPaid, onFailed }: Props) {
  const { t } = useI18n()
  const [status, setStatus] = useState(transaction.status)

  useEffect(() => {
    let cancelled = false
    const tick = async () => {
      const res = await getPaywayStatus(transaction.aba_tran_id)
      if (cancelled) return
      if (res.status) setStatus(res.status)
      if (res.status === "completed") onPaid()
      else if (res.status === "failed" || res.status === "expired") {
        onFailed(t("membership.tryAgain"))
      }
    }
    const id = setInterval(() => {
      void tick()
    }, 4000)
    void tick()
    return () => {
      cancelled = true
      clearInterval(id)
    }
  }, [transaction.aba_tran_id, onFailed, onPaid, t])

  const qrSrc =
    checkout.qr_image ||
    (checkout.qr_string
      ? `https://api.qrserver.com/v1/create-qr-code/?size=280x280&data=${encodeURIComponent(checkout.qr_string)}`
      : checkout.checkout_url)

  return (
    <div>
      {qrSrc ? (
        <div className="block w-full max-w-[min(280px,100%)] aspect-square mx-auto mb-5 bg-[var(--surface)] p-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={qrSrc} alt="ABA PayWay KHQR" className="w-full h-full object-contain" />
        </div>
      ) : null}

      <div className="text-center mb-4">
        <p className="text-[14px] text-[var(--text-secondary)] mb-1">{t("payment.scanHint")}</p>
        <p className="text-[13px] text-[var(--text-secondary)]">{t("payment.abaPayee")}</p>
        <p className="text-[13px] text-[var(--text-secondary)] mt-2">{t("payment.waitingForPayment")}</p>
        <p className="text-[12px] font-mono text-[var(--text-secondary)] mt-1">{transaction.aba_tran_id}</p>
        <p className="text-[12px] uppercase tracking-wide text-[var(--accent)] mt-2">{status}</p>
      </div>

      {checkout.abapay_deeplink ? (
        <a
          href={checkout.abapay_deeplink}
          className="btn-primary w-full h-11 text-[14px] inline-flex items-center justify-center gap-2 mb-3"
        >
          <Smartphone className="h-4 w-4" />
          {t("payment.openAbaApp")}
        </a>
      ) : checkout.checkout_url ? (
        <a
          href={checkout.checkout_url}
          target="_blank"
          rel="noopener noreferrer"
          className="btn-primary w-full h-11 text-[14px] inline-flex items-center justify-center mb-3"
        >
          {t("payment.openAbaApp")}
        </a>
      ) : null}
    </div>
  )
}
