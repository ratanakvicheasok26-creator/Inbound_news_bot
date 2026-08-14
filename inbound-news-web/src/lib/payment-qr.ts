import type { MembershipPlan } from "./plans"

/**
 * Payment QR codes shown in the membership pricing modal — one per plan so the
 * amount is pre-filled when the user scans (easiest way to pay).
 *
 * Pro      → `public/khqr7_9.png`   ($7.99 baked in)
 * Premium  → `public/khqr49_99.png` ($49.99 baked in)
 *
 * To override with hosted URLs, set `NEXT_PUBLIC_MEMBERSHIP_QR_PRO_URL` /
 * `NEXT_PUBLIC_MEMBERSHIP_QR_PREMIUM_URL` in your env.
 */
export const MEMBERSHIP_QR_URLS: Record<MembershipPlan, string> = {
  pro_monthly: process.env.NEXT_PUBLIC_MEMBERSHIP_QR_PRO_URL || "/khqr7_9.png",
  premium_yearly:
    process.env.NEXT_PUBLIC_MEMBERSHIP_QR_PREMIUM_URL || "/khqr49_99.png",
}

export function paymentQrUrl(plan: MembershipPlan): string {
  return MEMBERSHIP_QR_URLS[plan]
}
