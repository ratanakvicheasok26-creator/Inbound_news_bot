import { useEffect, useState, useCallback } from "react"
import { supabase } from "./supabase"
import { isActiveMembership } from "./plans"
import { canAccess, hasPremiumAccess, type Feature } from "./access"
import type { Membership, MembershipPlan } from "./stripe"

export type { Membership, MembershipPlan }
export { isActiveMembership }

type MembershipState = { loading: boolean; membership: Membership | null; refresh: () => void }

/**
 * Global version counter. Incrementing this forces every mounted useMembership()
 * hook to re-fetch from the API, which is needed after payment webhooks or QR
 * approval update the membership row server-side.
 */
let membershipVersion = 0
const membershipListeners = new Set<() => void>()

/** Force every useMembership() hook to re-fetch. Call after payment events. */
export function refreshAllMemberships() {
  membershipVersion++
  for (const fn of membershipListeners) fn()
}

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
  aba_transaction_id: string | null
  payment_proof_url?: string | null
  status: QrSubmissionStatus
  created_at: string
  reviewed_at: string | null
}

/** Short-lived signed URL for the caller's own payment screenshot (legacy rows only). */
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
      body: JSON.stringify({ plan }),
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

/** Hook for interactive components — resolves the membership on mount,
 *  and re-fetches when refreshAllMemberships() is called. */
export function useMembership(): MembershipState {
  const [membership, setMembership] = useState<Membership | null>(null)
  const [initialLoad, setInitialLoad] = useState(true)
  const [version, setVersion] = useState(membershipVersion)

  useEffect(() => {
    function handleVersionChange() {
      setVersion((v) => v + 1)
    }
    membershipListeners.add(handleVersionChange)
    return () => {
      membershipListeners.delete(handleVersionChange)
    }
  }, [])

  useEffect(() => {
    let active = true
    getMembership().then((m) => {
      if (active) {
        setMembership(m)
        setInitialLoad(false)
      }
    })
    return () => {
      active = false
    }
  }, [version])

  const refresh = useCallback(() => {
    refreshAllMemberships()
  }, [])

  return { loading: initialLoad, membership, refresh }
}

/** Client-side feature gate state — permission rules live in lib/access. */
export function useFeatureAccess(feature: Feature): {
  loading: boolean
  allowed: boolean
  membership: Membership | null
  refresh: () => void
} {
  const { loading, membership, refresh } = useMembership()
  return { loading, allowed: canAccess(membership, feature), membership, refresh }
}

/**
 * Unified premium access hook — returns true when the user holds an active
 * Pro ($7.99/mo) or Premium ($49.99/yr) subscription. Both plans grant
 * identical, full premium feature access.
 */
export function usePremiumAccess(): {
  loading: boolean
  hasPremiumAccess: boolean
  membership: Membership | null
  refresh: () => void
} {
  const { loading, membership, refresh } = useMembership()
  return { loading, hasPremiumAccess: hasPremiumAccess(membership), membership, refresh }
}

/* ------------------------------------------------------------------ */
/*  Payment Orders — structured order / payment-code flow              */
/* ------------------------------------------------------------------ */

export type PaymentOrderStatus = "created" | "pending" | "approved" | "rejected"

export type PaymentOrder = {
  id: string
  order_id: string
  payment_code: string
  plan: MembershipPlan
  amount: number
  currency: string
  status: PaymentOrderStatus
  transaction_code: string | null
  created_at: string
  submitted_at: string | null
  reviewed_at: string | null
}

export type AdminPaymentOrder = PaymentOrder & {
  user_id: string
  user_email: string | null
  verified_by: string | null
}

/** Create a new payment order → returns order details + payment code. */
export async function createOrder(
  plan: MembershipPlan,
): Promise<{ order?: PaymentOrder; error?: string }> {
  const token = await getAccessToken()
  if (!token) return { error: "auth" }
  try {
    const res = await fetch("/api/membership/create-order", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ plan }),
    })
    const data = (await res.json().catch(() => ({}))) as {
      order?: PaymentOrder
      error?: string
    }
    if (!res.ok) return { error: data.error || "failed" }
    return { order: data.order }
  } catch {
    return { error: "failed" }
  }
}

/** Submit a payment code after paying → sets order status to "pending". */
export async function submitPaymentCode(
  paymentCode: string,
): Promise<{ ok?: boolean; error?: string }> {
  const token = await getAccessToken()
  if (!token) return { error: "auth" }
  try {
    const res = await fetch("/api/membership/submit-code", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ payment_code: paymentCode }),
    })
    const data = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string }
    if (!res.ok) return { error: data.error || "failed" }
    return { ok: true }
  } catch {
    return { error: "failed" }
  }
}

/** Fetch the current user's payment orders. */
export async function getOrders(): Promise<PaymentOrder[]> {
  const token = await getAccessToken()
  if (!token) return []
  try {
    const res = await fetch("/api/membership/orders", {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    })
    if (!res.ok) return []
    const data = (await res.json()) as { orders?: PaymentOrder[] }
    return data.orders ?? []
  } catch {
    return []
  }
}

/** Admin: list all payment orders. Returns null when caller is not admin. */
export async function listAllOrders(): Promise<AdminPaymentOrder[] | null> {
  const token = await getAccessToken()
  if (!token) return null
  try {
    const res = await fetch("/api/admin/payments", {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    })
    if (!res.ok) return null
    const data = (await res.json()) as { orders?: AdminPaymentOrder[] }
    return data.orders ?? []
  } catch {
    return null
  }
}

/** Admin: approve or reject a payment order. */
export async function reviewOrder(
  id: string,
  action: "approve" | "reject",
): Promise<{ ok: boolean; error?: string }> {
  const token = await getAccessToken()
  if (!token) return { ok: false, error: "auth" }
  try {
    const res = await fetch("/api/admin/payments/review", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ id, action }),
    })
    if (!res.ok) {
      const data = (await res.json().catch(() => ({}))) as { error?: string }
      return { ok: false, error: data.error || "failed" }
    }
    return { ok: true }
  } catch {
    return { ok: false, error: "failed" }
  }
}
