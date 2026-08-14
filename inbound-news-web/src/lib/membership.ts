import { useEffect, useState } from "react"
import { supabase } from "./supabase"
import { isActiveMembership } from "./plans"
import type { Membership, MembershipPlan } from "./stripe"

export type { Membership, MembershipPlan }
export { isActiveMembership }

type MembershipState = { loading: boolean; membership: Membership | null }

export async function getAccessToken(): Promise<string | null> {
  const {
    data: { session },
  } = await supabase.auth.getSession()
  return session?.access_token ?? null
}

/** Current user's membership row, or null when signed out / no plan / not configured. */
export async function getMembership(): Promise<Membership | null> {
  const token = await getAccessToken()
  if (!token) return null
  try {
    const res = await fetch("/api/membership", {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    })
    if (!res.ok) return null
    const data = (await res.json()) as { membership: Membership | null }
    return data.membership ?? null
  } catch {
    return null
  }
}

export async function subscribe(
  plan: MembershipPlan,
): Promise<{ url: string } | { error: "auth" | "configured" | "already" | "failed" }> {
  const token = await getAccessToken()
  if (!token) return { error: "auth" }
  try {
    const res = await fetch("/api/membership/checkout", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ plan }),
    })
    const data = (await res.json().catch(() => ({}))) as { url?: string; error?: string }
    if (!res.ok) {
      if (res.status === 401) return { error: "auth" }
      if (res.status === 503) return { error: "configured" }
      if (res.status === 409) return { error: "already" }
      return { error: "failed" }
    }
    if (!data.url) return { error: "failed" }
    return { url: data.url }
  } catch {
    return { error: "failed" }
  }
}

export async function openBillingPortal(): Promise<string | null> {
  const token = await getAccessToken()
  if (!token) return null
  try {
    const res = await fetch("/api/membership/portal", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
    })
    if (!res.ok) return null
    const data = (await res.json()) as { url?: string }
    return data.url ?? null
  } catch {
    return null
  }
}

export type QrSubmissionStatus = "pending" | "approved" | "rejected"

export type QrSubmission = {
  id: string
  plan: MembershipPlan
  amount: number
  currency?: string | null
  aba_transaction_id: string
  payment_proof_url?: string | null
  status: QrSubmissionStatus
  created_at: string
  reviewed_at: string | null
}

export async function uploadPaymentProof(
  file: File,
): Promise<{ key?: string; error?: string; status?: number }> {
  const token = await getAccessToken()
  if (!token) return { error: "auth" }
  try {
    const form = new FormData()
    form.append("file", file)
    const res = await fetch("/api/membership/upload-proof", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: form,
    })
    const data = (await res.json().catch(() => ({}))) as { key?: string; error?: string }
    if (!res.ok) return { error: data.error || "failed", status: res.status }
    return { key: data.key }
  } catch {
    return { error: "failed" }
  }
}

/** Short-lived signed URL for the caller's own payment screenshot. */
export async function getProofUrl(key: string): Promise<string | null> {
  const token = await getAccessToken()
  if (!token) return null
  try {
    const res = await fetch(`/api/membership/qr-proof?key=${encodeURIComponent(key)}`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    })
    if (!res.ok) return null
    const data = (await res.json()) as { url?: string }
    return data.url ?? null
  } catch {
    return null
  }
}

export async function submitQrPayment(
  plan: MembershipPlan,
  abaTransactionId: string,
  paymentProofKey?: string | null,
): Promise<{ submission?: QrSubmission; error?: string; status?: number }> {
  const token = await getAccessToken()
  if (!token) return { error: "auth" }
  try {
    const res = await fetch("/api/membership/qr-submit", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        plan,
        aba_transaction_id: abaTransactionId,
        payment_proof_url: paymentProofKey ?? null,
      }),
    })
    const data = (await res.json().catch(() => ({}))) as {
      submission?: QrSubmission
      error?: string
    }
    if (!res.ok) return { error: data.error || "failed", status: res.status }
    return { submission: data.submission }
  } catch {
    return { error: "failed" }
  }
}

export async function getQrSubmissions(): Promise<QrSubmission[]> {
  const token = await getAccessToken()
  if (!token) return []
  try {
    const res = await fetch("/api/membership/qr-submissions", {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    })
    if (!res.ok) return []
    const data = (await res.json()) as { submissions?: QrSubmission[] }
    return data.submissions ?? []
  } catch {
    return []
  }
}

export type AdminQrSubmission = QrSubmission & {
  user_id: string
  user_email: string | null
}

/** All QR submissions — admin only. Returns null when the caller isn't an admin. */
export async function listQrSubmissions(): Promise<AdminQrSubmission[] | null> {
  const token = await getAccessToken()
  if (!token) return null
  try {
    const res = await fetch("/api/membership/qr-list", {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    })
    if (!res.ok) return null
    const data = (await res.json()) as { submissions?: AdminQrSubmission[] }
    return data.submissions ?? []
  } catch {
    return null
  }
}

export async function reviewQrSubmission(
  id: string,
  action: "approve" | "reject",
): Promise<{ ok: boolean; error?: string; status?: number }> {
  const token = await getAccessToken()
  if (!token) return { ok: false, error: "auth" }
  try {
    const res = await fetch("/api/membership/qr-review", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ id, action }),
    })
    if (!res.ok) {
      const data = (await res.json().catch(() => ({}))) as { error?: string; status?: string }
      return { ok: false, error: data.error || data.status || "failed", status: res.status }
    }
    return { ok: true }
  } catch {
    return { ok: false, error: "failed" }
  }
}

/** Hook for interactive components — resolves the membership once on mount. */
export function useMembership(): MembershipState {
  const [state, setState] = useState<MembershipState>({ loading: true, membership: null })

  useEffect(() => {
    let mounted = true
    getMembership().then((membership) => {
      if (!mounted) return
      setState({ loading: false, membership })
    })
    return () => {
      mounted = false
    }
  }, [])

  return state
}
