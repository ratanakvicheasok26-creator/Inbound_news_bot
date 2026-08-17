"use client"

import { useState, useEffect, useCallback } from "react"
import { listAllOrders, reviewOrder } from "@/lib/membership"
import { PLANS } from "@/lib/plans"
import type { AdminPaymentOrder } from "@/lib/membership"

const STATUS_LABELS: Record<string, string> = {
  created: "Awaiting payment",
  pending: "Pending review",
  approved: "Approved",
  rejected: "Rejected",
}

function formatDate(iso: string | null): string {
  if (!iso) return "—"
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return "—"
  return d.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

export default function AdminPaymentsPage() {
  const [loading, setLoading] = useState(true)
  const [forbidden, setForbidden] = useState(false)
  const [orders, setOrders] = useState<AdminPaymentOrder[]>([])
  const [busyId, setBusyId] = useState<string | null>(null)
  const [error, setError] = useState("")

  const load = useCallback(async () => {
    setLoading(true)
    const list = await listAllOrders()
    if (list === null) {
      setForbidden(true)
      setLoading(false)
      return
    }
    setOrders(list)
    setForbidden(false)
    setLoading(false)
  }, [])

  /* eslint-disable react-hooks/set-state-in-effect -- fetch-on-mount for admin queue */
  useEffect(() => {
    load()
  }, [load])
  /* eslint-enable react-hooks/set-state-in-effect */

  async function handleReview(order: AdminPaymentOrder, action: "approve" | "reject") {
    if (busyId) return
    setBusyId(order.id)
    setError("")
    const res = await reviewOrder(order.id, action)
    if (!res.ok) {
      setError(res.error === "auth" ? "Signed out — refresh and try again." : "Something went wrong — please try again.")
      setBusyId(null)
      return
    }
    setOrders((prev) =>
      prev.map((o) =>
        o.id === order.id
          ? { ...o, status: action === "approve" ? "approved" : "rejected", reviewed_at: new Date().toISOString() }
          : o
      )
    )
    setBusyId(null)
  }

  const pending = orders.filter((o) => o.status === "pending")
  const created = orders.filter((o) => o.status === "created")
  const reviewed = orders.filter((o) => o.status === "approved" || o.status === "rejected")

  return (
    <div className="container container-lg py-10 md:py-14">
      <h1 className="page-title mb-2">Payment management</h1>
      <p className="text-[14px] text-[var(--text-secondary)] mb-8">
        Review and approve member payments. Admin only.
      </p>

      {error && (
        <p
          className="mb-6 p-3 rounded-[var(--radius-sm)] bg-[var(--red-subtle-bg)] text-[13px] font-semibold text-[var(--accent)]"
          role="alert"
        >
          {error}
        </p>
      )}

      {loading && <p className="text-[14px] text-[var(--text-secondary)]">Loading orders…</p>}

      {!loading && forbidden && (
        <div className="bg-[var(--surface)] border border-[var(--border)] rounded-[var(--radius)] p-6 text-[14px] text-[var(--text-secondary)]">
          This page is for site admins only.
        </div>
      )}

      {!loading && !forbidden && orders.length === 0 && (
        <div className="bg-[var(--surface)] border border-[var(--border)] rounded-[var(--radius)] p-6 text-[14px] text-[var(--text-secondary)]">
          No payment orders yet.
        </div>
      )}

      {!loading && !forbidden && pending.length > 0 && (
        <section className="mb-8">
          <h2 className="section-title mb-3">
            Pending Review ({pending.length})
          </h2>
          <div className="bg-[var(--surface)] border border-[var(--border)] rounded-[var(--radius)] divide-y divide-[var(--border)]">
            {pending.map((o) => (
              <OrderRow
                key={o.id}
                order={o}
                busy={busyId === o.id}
                onApprove={() => handleReview(o, "approve")}
                onReject={() => handleReview(o, "reject")}
              />
            ))}
          </div>
        </section>
      )}

      {!loading && !forbidden && created.length > 0 && (
        <section className="mb-8">
          <h2 className="section-title mb-3">
            Awaiting Payment ({created.length})
          </h2>
          <div className="bg-[var(--surface)] border border-[var(--border)] rounded-[var(--radius)] divide-y divide-[var(--border)]">
            {created.map((o) => (
              <OrderRow
                key={o.id}
                order={o}
                busy={busyId === o.id}
                onApprove={() => handleReview(o, "approve")}
                onReject={() => handleReview(o, "reject")}
              />
            ))}
          </div>
        </section>
      )}

      {!loading && !forbidden && reviewed.length > 0 && (
        <section>
          <h2 className="section-title mb-3">
            Reviewed ({reviewed.length})
          </h2>
          <div className="bg-[var(--surface)] border border-[var(--border)] rounded-[var(--radius)] divide-y divide-[var(--border)]">
            {reviewed.map((o) => (
              <OrderRow
                key={o.id}
                order={o}
                busy={busyId === o.id}
                onApprove={() => handleReview(o, "approve")}
                onReject={() => handleReview(o, "reject")}
              />
            ))}
          </div>
        </section>
      )}
    </div>
  )
}

function OrderRow({
  order,
  busy,
  onApprove,
  onReject,
}: {
  order: AdminPaymentOrder
  busy: boolean
  onApprove: () => void
  onReject: () => void
}) {
  const meta = PLANS[order.plan]
  const pending = order.status === "pending"
  return (
    <div className="px-5 py-4">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-[14px] font-semibold text-[var(--text-primary)] truncate">
            {order.user_email || "Unknown email"}
          </p>
          <p className="text-[13px] text-[var(--text-secondary)]">
            {meta?.name} · {Number(order.amount).toFixed(2)} {order.currency}
          </p>
          <p className="text-[12px] text-[var(--text-secondary)] mt-0.5">
            Order: {order.order_id} · Created: {formatDate(order.created_at)}
          </p>
          <p className="text-[12px] text-[var(--text-secondary)]">
            Payment Code: <span className="font-mono font-bold">{order.payment_code}</span>
            {order.transaction_code ? ` · Txn: ${order.transaction_code}` : ""}
          </p>
          <p className="text-[12px] text-[var(--text-secondary)]">
            Status: {STATUS_LABELS[order.status]}
            {order.reviewed_at ? ` · Reviewed: ${formatDate(order.reviewed_at)}` : ""}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {pending && (
            <>
              <button
                type="button"
                onClick={onApprove}
                disabled={busy}
                className="btn-primary text-[13px] h-9 px-4 disabled:opacity-60"
              >
                {busy ? "…" : "Approve"}
              </button>
              <button
                type="button"
                onClick={onReject}
                disabled={busy}
                className="btn-ghost text-[13px] h-9 px-4 disabled:opacity-60"
              >
                Reject
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
