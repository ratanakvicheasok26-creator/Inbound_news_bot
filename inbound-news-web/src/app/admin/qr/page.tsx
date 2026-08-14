"use client"

import { useState, useEffect, useCallback } from "react"
import { listQrSubmissions, reviewQrSubmission, getProofUrl } from "@/lib/membership"
import { PLANS } from "@/lib/plans"
import type { AdminQrSubmission } from "@/lib/membership"

const STATUS_LABELS: Record<string, string> = {
  pending: "Pending",
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

export default function AdminQrReviewPage() {
  const [loading, setLoading] = useState(true)
  const [forbidden, setForbidden] = useState(false)
  const [submissions, setSubmissions] = useState<AdminQrSubmission[]>([])
  const [busyId, setBusyId] = useState<string | null>(null)
  const [error, setError] = useState("")

  const load = useCallback(async () => {
    setLoading(true)
    const list = await listQrSubmissions()
    if (list === null) {
      setForbidden(true)
      setLoading(false)
      return
    }
    setSubmissions(list)
    setForbidden(false)
    setLoading(false)
  }, [])

  /* eslint-disable react-hooks/set-state-in-effect -- fetch-on-mount for admin queue */
  useEffect(() => {
    load()
  }, [load])
  /* eslint-enable react-hooks/set-state-in-effect */

  async function handleReview(sub: AdminQrSubmission, action: "approve" | "reject") {
    if (busyId) return
    setBusyId(sub.id)
    setError("")
    const res = await reviewQrSubmission(sub.id, action)
    if (!res.ok) {
      setError(res.error === "auth" ? "Signed out — refresh and try again." : "Something went wrong — please try again.")
      setBusyId(null)
      return
    }
    setSubmissions((prev) =>
      prev.map((s) =>
        s.id === sub.id
          ? { ...s, status: action === "approve" ? "approved" : "rejected", reviewed_at: new Date().toISOString() }
          : s
      )
    )
    setBusyId(null)
  }

  async function handleViewProof(sub: AdminQrSubmission) {
    if (!sub.payment_proof_url || busyId) return
    setBusyId(sub.id)
    setError("")
    const url = await getProofUrl(sub.payment_proof_url)
    setBusyId(null)
    if (url) {
      window.open(url, "_blank", "noopener,noreferrer")
    } else {
      setError("Couldn't load the screenshot — please try again.")
    }
  }

  const pending = submissions.filter((s) => s.status === "pending")
  const reviewed = submissions.filter((s) => s.status !== "pending")

  return (
    <div className="container container-lg py-10 md:py-14">
      <h1 className="page-title mb-2">QR payment review</h1>
      <p className="text-[14px] text-[var(--text-secondary)] mb-8">
        Verify ABA transaction IDs before approving memberships. Admin only.
      </p>

      {error && (
        <p
          className="mb-6 p-3 rounded-[var(--radius-sm)] bg-[var(--red-subtle-bg)] text-[13px] font-semibold text-[var(--accent)]"
          role="alert"
        >
          {error}
        </p>
      )}

      {loading && <p className="text-[14px] text-[var(--text-secondary)]">Loading submissions…</p>}

      {!loading && forbidden && (
        <div className="bg-[var(--surface)] border border-[var(--border)] rounded-[var(--radius)] p-6 text-[14px] text-[var(--text-secondary)]">
          This page is for site admins only.
        </div>
      )}

      {!loading && !forbidden && submissions.length === 0 && (
        <div className="bg-[var(--surface)] border border-[var(--border)] rounded-[var(--radius)] p-6 text-[14px] text-[var(--text-secondary)]">
          No QR payment submissions yet.
        </div>
      )}

      {!loading && !forbidden && pending.length > 0 && (
        <section className="mb-8">
          <h2 className="section-title mb-3">
            Pending ({pending.length})
          </h2>
          <div className="bg-[var(--surface)] border border-[var(--border)] rounded-[var(--radius)] divide-y divide-[var(--border)]">
            {pending.map((s) => (
              <SubmissionRow
                key={s.id}
                sub={s}
                busy={busyId === s.id}
                onApprove={() => handleReview(s, "approve")}
                onReject={() => handleReview(s, "reject")}
                onViewProof={() => handleViewProof(s)}
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
            {reviewed.map((s) => (
              <SubmissionRow
                key={s.id}
                sub={s}
                busy={busyId === s.id}
                onApprove={() => handleReview(s, "approve")}
                onReject={() => handleReview(s, "reject")}
                onViewProof={() => handleViewProof(s)}
              />
            ))}
          </div>
        </section>
      )}
    </div>
  )
}

function SubmissionRow({
  sub,
  busy,
  onApprove,
  onReject,
  onViewProof,
}: {
  sub: AdminQrSubmission
  busy: boolean
  onApprove: () => void
  onReject: () => void
  onViewProof: () => void
}) {
  const meta = PLANS[sub.plan]
  const pending = sub.status === "pending"
  return (
    <div className="px-5 py-4 flex flex-wrap items-center justify-between gap-4">
      <div className="min-w-0">
        <p className="text-[14px] font-semibold text-[var(--text-primary)] truncate">
          {sub.user_email || "Unknown email"}
        </p>
        <p className="text-[13px] text-[var(--text-secondary)]">
          {meta?.name} · {Number(sub.amount).toFixed(2)} {sub.currency || "USD"} · Txn{" "}
          {sub.aba_transaction_id} · {formatDate(sub.created_at)}
        </p>
        <p className="text-[12px] text-[var(--text-secondary)]">
          {STATUS_LABELS[sub.status]}
          {sub.reviewed_at ? ` · reviewed ${formatDate(sub.reviewed_at)}` : ""}
        </p>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {sub.payment_proof_url && (
          <button
            type="button"
            onClick={onViewProof}
            disabled={busy}
            className="btn-ghost text-[13px] h-9 px-4 disabled:opacity-60"
          >
            {busy ? "…" : "View proof"}
          </button>
        )}
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
  )
}
