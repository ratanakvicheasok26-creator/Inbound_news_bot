"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import Link from "next/link"
import { Copy, CheckCheck } from "lucide-react"
import { useMembership, isActiveMembership, refreshAllMemberships, getOrders, submitPaymentCode } from "@/lib/membership"
import { PLANS, priceLabel } from "@/lib/plans"
import { PaymentSuccessModal } from "@/components/membership/PaymentSuccessModal"
import { useI18n } from "@/lib/i18n/LocaleProvider"
import type { Membership, PaymentOrder } from "@/lib/membership"

const STATUS_KEYS: Record<Membership["status"], string> = {
  active: "account.membershipTab.statusActive",
  trialing: "account.membershipTab.statusTrial",
  past_due: "account.membershipTab.statusPastDue",
  canceled: "account.membershipTab.statusCanceled",
  incomplete: "account.membershipTab.statusIncomplete",
  unpaid: "account.membershipTab.statusUnpaid",
}

const ORDER_STATUS: Record<PaymentOrder["status"], { key: string; tone: string }> = {
  created: { key: "account.orderStatus.created", tone: "text-[var(--text-secondary)] bg-[var(--surface-alt)]" },
  pending: { key: "account.orderStatus.pending", tone: "text-[var(--text-secondary)] bg-[var(--surface-alt)]" },
  approved: { key: "account.orderStatus.approved", tone: "text-[var(--text-primary)] bg-[var(--red-subtle-bg)]" },
  rejected: { key: "account.orderStatus.rejected", tone: "text-[var(--text-secondary)] bg-[var(--surface-alt)]" },
}

function formatDate(iso: string | null): string | null {
  if (!iso) return null
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return null
  return d.toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" })
}

export function MembershipTab() {
  const { t } = useI18n()
  const { loading, membership } = useMembership()
  const member = isActiveMembership(membership)
  const [orders, setOrders] = useState<PaymentOrder[]>([])
  const [ordersLoaded, setOrdersLoaded] = useState(false)
  const [celebrate, setCelebrate] = useState<PaymentOrder | null>(null)
  const seenPendingRef = useRef<Set<string>>(new Set())
  const hasPendingRef = useRef(false)
  const [refreshTick, setRefreshTick] = useState(0)

  const loadOrders = useCallback(async () => {
    const list = await getOrders()
    setOrders(list)
    setOrdersLoaded(true)
    hasPendingRef.current = list.some((o) => o.status === "pending" || o.status === "created")

    for (const o of list) {
      if (o.status === "approved" && seenPendingRef.current.has(o.id)) {
        seenPendingRef.current.delete(o.id)
        setCelebrate(o)
        refreshAllMemberships()
      }
    }
    const nowPending = new Set(list.filter((o) => o.status === "pending").map((o) => o.id))
    for (const id of nowPending) seenPendingRef.current.add(id)
  }, [])

  useEffect(() => {
    let mounted = true
    let timer: ReturnType<typeof setTimeout> | undefined
    let attempts = 0

    async function tick() {
      attempts += 1
      if (!mounted) return
      await loadOrders()
      if (!hasPendingRef.current) return
      const interval = attempts >= 10 ? 30000 : 8000
      timer = setTimeout(tick, interval)
    }

    tick()
    return () => {
      mounted = false
      clearTimeout(timer)
    }
  }, [refreshTick, loadOrders])

  if (loading) {
    return (
      <p className="text-[14px] text-[var(--text-secondary)] py-8">{t("account.membershipTab.loading")}</p>
    )
  }

  if (!member) {
    return (
      <div>
        <div className="bg-[var(--surface)] border border-[var(--border)] rounded-[var(--radius)] p-6 mb-6">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div>
              <h3 className="font-display text-[18px] font-semibold mb-1">{t("account.membershipTab.freePlanTitle")}</h3>
              <p className="text-[14px] text-[var(--text-secondary)] max-w-[52ch]">
                {t("account.membershipTab.freePlanBody")}
              </p>
            </div>
            <Link href="/pricing" className="btn-primary text-[14px] h-10 px-5">
              {t("account.membershipTab.seePlans")}
            </Link>
          </div>
        </div>
        <div className="bg-[var(--surface)] border border-[var(--border)] rounded-[var(--radius)] p-6">
          <h3 className="font-display text-[16px] font-semibold mb-2">{t("account.membershipTab.whyJoin")}</h3>
          <ul className="space-y-1.5 text-[14px] text-[var(--text-secondary)]">
            <li>• {t("account.membershipTab.join1")}</li>
            <li>• {t("account.membershipTab.join2")}</li>
            <li>• {t("account.membershipTab.join3")}</li>
          </ul>
        </div>

        <OrdersSection
          orders={orders}
          loaded={ordersLoaded}
          onRefresh={() => { setRefreshTick((v) => v + 1) }}
        />

        {celebrate && (
          <PaymentSuccessModal plan={celebrate.plan} onClose={() => setCelebrate(null)} />
        )}
      </div>
    )
  }

  const meta = membership ? PLANS[membership.plan] : null
  const periodEnd = formatDate(membership?.current_period_end ?? null)

  return (
    <div>
      <div className="bg-[var(--surface)] border border-[var(--border)] rounded-[var(--radius)] p-6">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <h3 className="font-display text-[18px] font-semibold">
                {meta?.name} — {membership ? priceLabel(membership.plan) : ""}
              </h3>
              <span className="text-[11px] font-semibold uppercase tracking-wide text-[var(--accent)] bg-[var(--red-subtle-bg)] rounded-full px-2 py-0.5">
                {membership ? t(STATUS_KEYS[membership.status]) : ""}
              </span>
            </div>
            <p className="text-[14px] text-[var(--text-secondary)]">
              {periodEnd
                ? t("account.membershipTab.nextBilling", { date: periodEnd })
                : t("account.membershipTab.activeSubscription")}
              {membership?.cancel_at_period_end ? t("account.membershipTab.cancelsAtEnd") : ""}
            </p>
          </div>
        </div>
        {membership?.cancel_at_period_end && (
          <p className="mt-4 text-[13px] text-[var(--text-secondary)] max-w-[58ch]">
            {t("account.membershipTab.cancelNote")}
          </p>
        )}
      </div>

      <OrdersSection
        orders={orders}
        loaded={ordersLoaded}
        onRefresh={() => { setRefreshTick((v) => v + 1) }}
      />

      {celebrate && (
        <PaymentSuccessModal plan={celebrate.plan} onClose={() => setCelebrate(null)} />
      )}
    </div>
  )
}

function OrdersSection({
  orders,
  loaded,
  onRefresh,
}: {
  orders: PaymentOrder[]
  loaded: boolean
  onRefresh?: () => void
}) {
  const { t } = useI18n()

  const pendingOrders = orders.filter((o) => o.status === "created" || o.status === "pending")
  const pastOrders = orders.filter((o) => o.status === "approved" || o.status === "rejected")

  if (!loaded) return null

  return (
    <div className="mt-6 bg-[var(--surface)] border border-[var(--border)] rounded-[var(--radius)] p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-display text-[16px] font-semibold">{t("account.membershipTab.qrPayments")}</h3>
        {onRefresh && (
          <button
            type="button"
            onClick={onRefresh}
            className="text-[13px] font-semibold text-[var(--accent)] hover:text-[var(--accent-hover)]"
          >
            {t("account.membershipTab.refresh")}
          </button>
        )}
      </div>

      {orders.length === 0 ? (
        <p className="text-[14px] text-[var(--text-secondary)]">
          {t("account.membershipTab.qrEmptyBody1")}{" "}
          <Link href="/pricing" className="font-semibold text-[var(--accent)] hover:text-[var(--accent-hover)]">
            {t("account.membershipTab.pricingPage")}
          </Link>{" "}
          {t("account.membershipTab.qrEmptyBody2")}
        </p>
      ) : (
        <>
          {pendingOrders.length > 0 && (
            <div className="mb-4">
              <p className="text-[12px] font-semibold uppercase tracking-wide text-[var(--text-secondary)] mb-2">
                {t("account.activeOrders")} ({pendingOrders.length})
              </p>
              <ul className="divide-y divide-[var(--border)]">
                {pendingOrders.map((o) => (
                  <OrderRow key={o.id} order={o} />
                ))}
              </ul>
            </div>
          )}
          {pastOrders.length > 0 && (
            <div>
              <p className="text-[12px] font-semibold uppercase tracking-wide text-[var(--text-secondary)] mb-2">
                {t("account.pastOrders")} ({pastOrders.length})
              </p>
              <ul className="divide-y divide-[var(--border)]">
                {pastOrders.map((o) => (
                  <OrderRow key={o.id} order={o} />
                ))}
              </ul>
            </div>
          )}
        </>
      )}
    </div>
  )
}

function OrderRow({ order }: { order: PaymentOrder }) {
  const { t } = useI18n()
  const meta = PLANS[order.plan]
  const statusInfo = ORDER_STATUS[order.status]
  const [copied, setCopied] = useState(false)
  const [code, setCode] = useState("")
  const [busy, setBusy] = useState(false)
  const [submitError, setSubmitError] = useState("")
  const [submitted, setSubmitted] = useState(order.status !== "created")

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(order.payment_code).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }, [order.payment_code])

  async function handleSubmitCode() {
    const trimmed = code.trim().toUpperCase()
    if (!trimmed) return
    setBusy(true)
    setSubmitError("")
    const res = await submitPaymentCode(trimmed)
    if (res.ok) {
      setSubmitted(true)
      refreshAllMemberships()
    } else {
      setSubmitError(res.error === "invalid_code" ? t("payment.errorInvalidCode") : res.error === "already_submitted" ? t("payment.errorAlreadySubmitted") : t("membership.tryAgain"))
    }
    setBusy(false)
  }

  return (
    <li className="py-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-[14px] font-semibold text-[var(--text-primary)]">
            {meta?.name} · {Number(order.amount).toFixed(2)} {order.currency}
          </p>
          <p className="text-[13px] text-[var(--text-secondary)]">
            {order.order_id} · {formatDate(order.created_at)}
          </p>
        </div>
        <span className={`text-[11px] font-semibold uppercase tracking-wide rounded-full px-2 py-1 ${statusInfo.tone}`}>
          {t(statusInfo.key)}
        </span>
      </div>

      {order.status === "created" && !submitted && (
        <div className="mt-3">
          <p className="text-[12px] text-[var(--text-secondary)] mb-1.5">{t("account.copyPaymentCode")}</p>
          <div className="flex items-center gap-2 mb-2">
            <code className="flex-1 text-[14px] font-mono font-bold tracking-wider text-[var(--text-primary)] bg-[var(--surface-alt)] border border-[var(--border)] rounded px-3 py-1.5">
              {order.payment_code}
            </code>
            <button
              type="button"
              onClick={handleCopy}
              className="shrink-0 w-8 h-8 flex items-center justify-center rounded border border-[var(--border)] hover:bg-[var(--surface-alt)]"
              aria-label="Copy payment code"
            >
              {copied ? <CheckCheck className="h-3.5 w-3.5 text-green-500" /> : <Copy className="h-3.5 w-3.5 text-[var(--text-secondary)]" />}
            </button>
          </div>

          <div className="flex gap-2">
            <input
              type="text"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder={t("payment.paymentCodeLabel")}
              className="flex-1 h-9 px-2 rounded border border-[var(--border)] bg-[var(--surface)] text-[13px] font-mono text-[var(--text-primary)] placeholder:text-[var(--text-secondary)] focus:outline-none focus:border-[var(--accent)]"
            />
            <button
              type="button"
              onClick={handleSubmitCode}
              disabled={busy || !code.trim()}
              className="btn-primary text-[13px] h-9 px-4 disabled:opacity-50"
            >
              {busy ? "…" : t("payment.submitCode")}
            </button>
          </div>
          {submitError && (
            <p className="mt-1.5 text-[12px] font-semibold text-[var(--accent)]">{submitError}</p>
          )}
        </div>
      )}

      {order.status === "created" && submitted && (
        <p className="mt-2 text-[13px] text-[var(--text-secondary)]">
          {t("payment.submittedNote")}
        </p>
      )}

      {order.status === "pending" && (
        <p className="mt-2 text-[13px] text-[var(--text-secondary)]">
          {t("payment.planActivatedAfterReview")}
        </p>
      )}
    </li>
  )
}
