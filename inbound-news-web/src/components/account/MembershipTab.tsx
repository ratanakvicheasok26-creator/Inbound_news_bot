"use client"

import { useState, useEffect, useRef } from "react"
import Link from "next/link"
import { useMembership, isActiveMembership, openBillingPortal, getQrSubmissions, getProofUrl } from "@/lib/membership"
import { PLANS, priceLabel } from "@/lib/plans"
import { PaymentSuccessModal } from "@/components/membership/PaymentSuccessModal"
import type { Membership, QrSubmission } from "@/lib/membership"

const STATUS_LABELS: Record<Membership["status"], string> = {
  active: "Active",
  trialing: "Trial",
  past_due: "Past due",
  canceled: "Canceled",
  incomplete: "Incomplete",
  unpaid: "Unpaid",
}

const SUBMISSION_STATUS: Record<QrSubmission["status"], { label: string; tone: string }> = {
  pending: { label: "Pending review", tone: "text-[var(--text-secondary)] bg-[var(--surface-alt)]" },
  approved: { label: "Approved", tone: "text-[var(--text-primary)] bg-[var(--red-subtle-bg)]" },
  rejected: { label: "Rejected", tone: "text-[var(--text-secondary)] bg-[var(--surface-alt)]" },
}

function formatDate(iso: string | null): string | null {
  if (!iso) return null
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return null
  return d.toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" })
}

export function MembershipTab() {
  const { loading, membership } = useMembership()
  const member = isActiveMembership(membership)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  const [submissions, setSubmissions] = useState<QrSubmission[]>([])
  const [subsLoaded, setSubsLoaded] = useState(false)
  const [celebrate, setCelebrate] = useState<QrSubmission | null>(null)
  const seenPendingRef = useRef<Set<string>>(new Set())

  useEffect(() => {
    let mounted = true
    let timer: ReturnType<typeof setTimeout> | undefined
    let attempts = 0

    async function tick() {
      attempts += 1
      const list = await getQrSubmissions()
      if (!mounted) return
      setSubmissions(list)
      setSubsLoaded(true)

      const nowPending = new Set(
        list.filter((s) => s.status === "pending").map((s) => s.id),
      )
      for (const s of list) {
        if (s.status === "approved" && seenPendingRef.current.has(s.id)) {
          seenPendingRef.current.delete(s.id)
          setCelebrate(s)
        }
      }
      for (const id of nowPending) seenPendingRef.current.add(id)

      if (nowPending.size === 0 || attempts >= 15) return
      timer = setTimeout(tick, 8000)
    }

    tick()
    return () => {
      mounted = false
      clearTimeout(timer)
    }
  }, [])

  async function handlePortal() {
    setBusy(true)
    setError("")
    const url = await openBillingPortal()
    if (url) {
      window.location.assign(url)
      return
    }
    setError("Couldn't open billing — please try again.")
    setBusy(false)
  }

  if (loading) {
    return (
      <p className="text-[14px] text-[var(--text-secondary)] py-8">Loading membership…</p>
    )
  }

  if (!member) {
    return (
      <div>
        <div className="bg-[var(--surface)] border border-[var(--border)] rounded-[var(--radius)] p-6 mb-6">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div>
              <h3 className="font-display text-[18px] font-semibold mb-1">Free plan</h3>
              <p className="text-[14px] text-[var(--text-secondary)] max-w-[52ch]">
                You’re on the free plan. Premium stories are for Pro and Premium members.
              </p>
            </div>
            <Link href="/pricing" className="btn-primary text-[14px] h-10 px-5">
              See plans
            </Link>
          </div>
        </div>
        <div className="bg-[var(--surface)] border border-[var(--border)] rounded-[var(--radius)] p-6">
          <h3 className="font-display text-[16px] font-semibold mb-2">Why join</h3>
          <ul className="space-y-1.5 text-[14px] text-[var(--text-secondary)]">
            <li>• Full access to premium stories, right when they’re published.</li>
            <li>• Funds independent coverage and the Telegram digest from Phnom Penh.</li>
            <li>• Cancel anytime from the billing portal.</li>
          </ul>
        </div>

        <QrSubmissionsSection submissions={submissions} loaded={subsLoaded} />

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
                {membership ? STATUS_LABELS[membership.status] : ""}
              </span>
            </div>
            <p className="text-[14px] text-[var(--text-secondary)]">
              {periodEnd ? `Next billing date: ${periodEnd}` : "Active subscription"}
              {membership?.cancel_at_period_end ? " · cancels at period end" : ""}
            </p>
          </div>
          <button
            type="button"
            onClick={handlePortal}
            disabled={busy}
            className="btn-ghost text-[14px] h-10 px-5 disabled:opacity-60"
          >
            {busy ? "Opening…" : "Manage billing"}
          </button>
        </div>
        {membership?.cancel_at_period_end && (
          <p className="mt-4 text-[13px] text-[var(--text-secondary)] max-w-[58ch]">
            Your plan is set to cancel at the end of the billing period — you keep premium
            access until then. Re-open it anytime from the billing portal.
          </p>
        )}
      </div>

      {error && (
        <p
          className="mt-4 p-3 rounded-[var(--radius-sm)] bg-[var(--red-subtle-bg)] text-[13px] font-semibold text-[var(--accent)]"
          role="alert"
        >
          {error}
        </p>
      )}

      <QrSubmissionsSection submissions={submissions} loaded={subsLoaded} />

      {celebrate && (
        <PaymentSuccessModal plan={celebrate.plan} onClose={() => setCelebrate(null)} />
      )}
    </div>
  )
}

function ViewProofButton({ proofKey }: { proofKey: string }) {
  const [busy, setBusy] = useState(false)
  const [failed, setFailed] = useState(false)

  async function handleView() {
    if (busy) return
    setBusy(true)
    setFailed(false)
    const url = await getProofUrl(proofKey)
    setBusy(false)
    if (url) {
      window.open(url, "_blank", "noopener,noreferrer")
    } else {
      setFailed(true)
    }
  }

  return (
    <span className="inline-flex items-center gap-1.5">
      {failed && <span className="text-[12px] text-[var(--text-secondary)]">Couldn’t load</span>}
      <button
        type="button"
        onClick={handleView}
        disabled={busy}
        className="text-[12px] font-semibold text-[var(--accent)] hover:text-[var(--accent-hover)] disabled:opacity-60"
      >
        {busy ? "Loading…" : "View proof"}
      </button>
    </span>
  )
}

function QrSubmissionsSection({
  submissions,
  loaded,
}: {
  submissions: QrSubmission[]
  loaded: boolean
}) {
  if (!loaded) return null
  if (submissions.length === 0) {
    return (
      <div className="mt-6 bg-[var(--surface)] border border-[var(--border)] rounded-[var(--radius)] p-6">
        <h3 className="font-display text-[16px] font-semibold mb-2">QR payments</h3>
        <p className="text-[14px] text-[var(--text-secondary)]">
          Paid by QR? Tap “I&apos;ve paid” on{" "}
          <Link href="/pricing" className="font-semibold text-[var(--accent)] hover:text-[var(--accent-hover)]">
            the pricing page
          </Link>{" "}
          and it will show up here for verification.
        </p>
      </div>
    )
  }

  return (
    <div className="mt-6 bg-[var(--surface)] border border-[var(--border)] rounded-[var(--radius)] p-6">
      <h3 className="font-display text-[16px] font-semibold mb-4">QR payments</h3>
      <ul className="divide-y divide-[var(--border)]">
        {submissions.map((s) => {
          const meta = PLANS[s.plan]
          const tone = SUBMISSION_STATUS[s.status].tone
          return (
          <li key={s.id} className="py-3 flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-[14px] font-semibold text-[var(--text-primary)]">
                {meta?.name} · {Number(s.amount).toFixed(2)} {s.currency || "USD"}
              </p>
              <p className="text-[13px] text-[var(--text-secondary)]">
                {s.aba_transaction_id ? `Txn ${s.aba_transaction_id} · ` : ""}
                {formatDate(s.created_at)}
              </p>
            </div>
            <div className="flex items-center gap-2">
              {s.payment_proof_url && (
                <ViewProofButton key={s.payment_proof_url} proofKey={s.payment_proof_url} />
              )}
              <span
                className={`text-[11px] font-semibold uppercase tracking-wide rounded-full px-2 py-1 ${tone}`}
              >
                {SUBMISSION_STATUS[s.status].label}
              </span>
            </div>
          </li>
          )
        })}
      </ul>
    </div>
  )
}
