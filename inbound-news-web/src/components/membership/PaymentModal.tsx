"use client"

import { useState, useEffect, useRef } from "react"
import { createPortal } from "react-dom"
import Image from "next/image"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { X, Check, ShieldCheck, Upload, ImagePlus } from "lucide-react"
import { PLANS, PLAN_FEATURES } from "@/lib/plans"
import { paymentQrUrl } from "@/lib/payment-qr"
import { submitQrPayment, uploadPaymentProof } from "@/lib/membership"
import type { MembershipPlan } from "@/lib/plans"
import type { QrSubmission } from "@/lib/membership"

const MAX_PROOF_BYTES = 5 * 1024 * 1024
const PROOF_ACCEPT = "image/jpeg,image/png,image/webp"

interface PaymentModalProps {
  plan: MembershipPlan
  onClose: () => void
}

type Step = "qr" | "txn" | "done"

/**
 * QR-code payment dialog for a single membership plan. The price is derived
 * from the plan metadata and can't be edited. After paying, the user submits
 * their ABA transaction ID and a payment screenshot; a site admin verifies the
 * payment before the membership activates.
 */
export function PaymentModal({ plan, onClose }: PaymentModalProps) {
  const router = useRouter()
  const meta = PLANS[plan]
  const price = `$${meta.price.toFixed(2)}/${meta.cadence}`

  const [step, setStep] = useState<Step>("qr")
  const [txnId, setTxnId] = useState("")
  const [proofFile, setProofFile] = useState<File | null>(null)
  const [proofPreview, setProofPreview] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  const [submission, setSubmission] = useState<QrSubmission | null>(null)
  const proofUrlRef = useRef("")

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") close()
    }
    document.addEventListener("keydown", onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = "hidden"
    return () => {
      document.removeEventListener("keydown", onKey)
      document.body.style.overflow = prev
      if (proofUrlRef.current) URL.revokeObjectURL(proofUrlRef.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function handleProofFile(e: React.ChangeEvent<HTMLInputElement>) {
    setError("")
    const file = e.target.files?.[0] ?? null
    if (!file) {
      setProofFile(null)
      setProofPreview("")
      return
    }
    if (!PROOF_ACCEPT.includes(file.type)) {
      setError("Please upload a JPG, PNG, or WebP screenshot.")
      e.target.value = ""
      return
    }
    if (file.size > MAX_PROOF_BYTES) {
      setError("Screenshot is too large — the maximum is 5 MB.")
      e.target.value = ""
      return
    }
    if (proofUrlRef.current) URL.revokeObjectURL(proofUrlRef.current)
    const url = URL.createObjectURL(file)
    proofUrlRef.current = url
    setProofFile(file)
    setProofPreview(url)
  }

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") close()
    }
    document.addEventListener("keydown", onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = "hidden"
    return () => {
      document.removeEventListener("keydown", onKey)
      document.body.style.overflow = prev
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function close() {
    onClose()
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError("")
    if (!proofFile) {
      setError("Please upload your payment screenshot.")
      return
    }
    setBusy(true)

    const up = await uploadPaymentProof(proofFile)
    if (!up.key) {
      setBusy(false)
      setError(
        up.error === "auth"
          ? "Signed out — refresh and try again."
          : up.error === "file_too_large"
            ? "Screenshot is too large — the maximum is 5 MB."
            : up.error === "unsupported_type"
              ? "Please upload a JPG, PNG, or WebP screenshot."
              : "Screenshot upload failed — please try again.",
      )
      return
    }

    const res = await submitQrPayment(plan, txnId, up.key)
    if ("submission" in res && res.submission) {
      setSubmission(res.submission)
      setStep("done")
    } else if (res.error === "auth") {
      close()
      router.push("/login?returnTo=/pricing")
    } else if (res.error === "already_member") {
      setError("You're already a member — premium stories are unlocked. Close and refresh to read.")
    } else {
      setError(res.error || "Something went wrong — please try again.")
    }
    setBusy(false)
  }

  return createPortal(
    <div
      className="fixed inset-0 z-[400] bg-[rgba(0,0,0,0.5)] flex items-center justify-center p-4"
      onClick={close}
      role="dialog"
      aria-modal="true"
      aria-label={`Pay for ${meta.name} plan`}
    >
      <div
        className="w-full max-w-[440px] bg-[var(--surface)] border border-[var(--border)] rounded-[var(--radius)] p-6 md:p-8 text-center shadow-[0_24px_64px_-24px_rgba(0,0,0,0.4)] max-h-[92vh] overflow-y-auto"
        style={{ animation: "riseIn 220ms ease-out" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-1 text-left">
          <h2 className="font-display text-[18px] font-semibold">{meta.name} Plan</h2>
          <button
            type="button"
            onClick={close}
            className="w-9 h-9 flex items-center justify-center rounded-[var(--radius-sm)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-alt)]"
            aria-label="Close payment dialog"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <p className="text-[28px] font-semibold leading-none mb-6">{price}</p>

        {step === "qr" && (
          <>
            <div className="flex items-center justify-center gap-2 mb-4">
              <span className="meta-text text-[var(--accent)]">KHQR payment</span>
            </div>

            <a
              href={paymentQrUrl(plan)}
              target="_blank"
              rel="noopener noreferrer"
              className="relative block w-full max-w-[300px] aspect-square mx-auto mb-5 bg-[var(--surface)] p-2 transition-opacity hover:opacity-80"
            >
              <Image
                src={paymentQrUrl(plan)}
                alt={`KHQR payment for ${meta.name} plan`}
                fill
                sizes="300px"
                priority
                className="object-contain"
              />
            </a>

            <p className="text-[14px] text-[var(--text-secondary)] mb-1">
              Scan with any KHQR-compatible app
            </p>
            <p className="text-[13px] text-[var(--text-secondary)]">
              ABA Bank · Inbound Crew
            </p>
            <p className="text-[13px] text-[var(--text-secondary)] mt-2">
              Pay <span className="font-semibold text-[var(--text-primary)]">exactly ${meta.price.toFixed(2)}</span>
            </p>

            <button
              type="button"
              onClick={() => setStep("txn")}
              className="btn-primary w-full h-11 mt-5"
            >
              I&apos;ve paid — submit transaction ID
            </button>
          </>
        )}

        {step === "txn" && (
          <form onSubmit={handleSubmit} className="text-left">
            <p className="text-[14px] text-[var(--text-secondary)] mb-4 max-w-[52ch]">
              After paying, enter the ABA transaction ID and upload your payment
              screenshot. Our team verifies it and unlocks your membership — usually
              within a few hours.
            </p>

            <label className="meta-text block mb-2">ABA transaction ID</label>
            <input
              type="text"
              required
              autoFocus
              minLength={4}
              maxLength={64}
              value={txnId}
              onChange={(e) => setTxnId(e.target.value)}
              placeholder="e.g. 001234567890"
              className="w-full px-3 h-11 bg-[var(--bg)] border border-[var(--border)] rounded-[var(--radius-sm)] text-[15px] focus:outline-none focus:border-[var(--text-secondary)]"
            />

            <label className="meta-text block mb-2 mt-4">
              Payment screenshot{" "}
              <span className="font-normal text-[var(--text-secondary)]">(JPG, PNG, or WebP · max 5 MB)</span>
            </label>
            <label className="flex items-center gap-3 w-full px-3 h-11 bg-[var(--bg)] border border-[var(--border)] rounded-[var(--radius-sm)] cursor-pointer transition-colors hover:border-[var(--text-secondary)]">
              {proofFile ? (
                <ImagePlus className="h-4 w-4 text-[var(--accent)] shrink-0" />
              ) : (
                <Upload className="h-4 w-4 text-[var(--text-secondary)] shrink-0" />
              )}
              <span
                className={`flex-1 text-[14px] truncate ${
                  proofFile ? "text-[var(--text-primary)]" : "text-[var(--text-secondary)]"
                }`}
              >
                {proofFile ? proofFile.name : "Choose payment screenshot"}
              </span>
              <input
                type="file"
                accept={PROOF_ACCEPT}
                className="sr-only"
                onChange={handleProofFile}
              />
            </label>

            {proofPreview && (
              <div className="mt-3 inline-block rounded-[var(--radius-sm)] overflow-hidden border border-[var(--border)]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={proofPreview}
                  alt="Payment screenshot preview"
                  className="max-h-40 w-auto block"
                />
              </div>
            )}

            {error && (
              <p
                className="mt-3 p-3 rounded-[var(--radius-sm)] bg-[var(--red-subtle-bg)] text-[13px] font-semibold text-[var(--accent)]"
                role="alert"
              >
                {error}
              </p>
            )}

            <div className="flex items-center gap-2 mt-5">
              <button
                type="button"
                onClick={() => {
                  setError("")
                  setStep("qr")
                }}
                className="btn-ghost h-11 px-4 text-[14px]"
              >
                Back
              </button>
              <button
                type="submit"
                disabled={busy || txnId.trim().length < 4 || !proofFile}
                className="btn-primary flex-1 h-11 text-[14px] disabled:opacity-50"
              >
                {busy ? "Submitting…" : "Submit for verification"}
              </button>
            </div>
          </form>
        )}

        {step === "done" && submission && (
          <div>
            <div className="mx-auto mb-4 w-14 h-14 rounded-full flex items-center justify-center bg-[var(--red-subtle-bg)]">
              <ShieldCheck className="h-7 w-7 text-[var(--accent)]" />
            </div>

            <div className="text-[12px] font-semibold uppercase tracking-wide text-[var(--accent)] mb-3">
              Payment received — verification pending
            </div>

            <p className="text-[14px] text-[var(--text-secondary)] mb-2 max-w-[52ch] mx-auto">
              Transaction ID{" "}
              <span className="font-semibold text-[var(--text-primary)]">
                {submission.aba_transaction_id}
              </span>{" "}
              for{" "}
              <span className="font-semibold text-[var(--text-primary)]">
                ${meta.price.toFixed(2)}
              </span>{" "}
              has been submitted. You&apos;ll see it on your account page until it&apos;s approved.
            </p>

            <div className="text-left bg-[var(--surface-alt)] border border-[var(--border)] rounded-[var(--radius-sm)] p-4 mb-5">
              <p className="text-[12px] font-semibold uppercase tracking-wide text-[var(--text-secondary)] mb-2">
                What you get once verified
              </p>
              <ul className="space-y-2 text-[14px] text-[var(--text-primary)]">
                {PLAN_FEATURES[plan].map((f) => (
                  <li key={f} className="flex items-start gap-2">
                    <Check className="h-4 w-4 shrink-0 mt-0.5 text-[var(--accent)]" />
                    {f}
                  </li>
                ))}
              </ul>
            </div>

            <p className="text-[13px] text-[var(--text-secondary)] mb-5 max-w-[52ch] mx-auto">
              No email? Check back any time — approval typically takes a few hours.
            </p>
            <div className="flex items-center gap-2">
              <Link
                href="/account?tab=membership"
                className="btn-primary flex-1 h-11 text-[14px] inline-flex items-center justify-center"
                onClick={close}
              >
                Track my submission
              </Link>
              <button type="button" onClick={close} className="btn-ghost h-11 px-4 text-[14px]">
                Close
              </button>
            </div>
          </div>
        )}
      </div>
    </div>,
    document.body
  )
}
