export type MembershipPlan = "pro_monthly" | "premium_yearly"

/**
 * True while a membership row still grants access. KHQR is prepaid (not
 * auto-renewing), so an `active` row whose period has ended is treated as
 * expired and the reader can pay again.
 */
export function isActiveMembership(
  m:
    | {
        status?: string
        current_period_end?: string | null
      }
    | null
    | undefined,
): boolean {
  if (!m || (m.status !== "active" && m.status !== "trialing")) return false
  if (m.current_period_end) {
    const end = new Date(m.current_period_end).getTime()
    if (Number.isFinite(end) && end <= Date.now()) return false
  }
  return true
}

/** Stripe Billing Portal only works when Checkout created a customer. */
export function hasStripeBilling(
  m: { stripe_customer_id?: string | null } | null | undefined,
): boolean {
  return Boolean(m?.stripe_customer_id)
}

/**
 * Display names for Monthly / Annual. Plan IDs stay `pro_monthly` and
 * `premium_yearly` so existing memberships rows keep working.
 */
export const PLANS: Record<
  MembershipPlan,
  {
    name: string
    price: number
    cadence: "month" | "year"
    periodMonths: number
    tagline: string
  }
> = {
  // Display / recorded amounts. Match public/khqr7_9.png ($7.99) and
  // public/khqr49_99.png ($49.99) with KHQR codes for live payments.
  pro_monthly: {
    name: "Pro",
    price: 7.99,
    cadence: "month",
    periodMonths: 1,
    tagline: "Full premium story access",
  },
  premium_yearly: {
    name: "Premium",
    price: 49.99,
    cadence: "year",
    periodMonths: 12,
    tagline: "All Pro benefits, billed yearly",
  },
}

/** i18n keys for the shared member benefit list (identical on both cadences). */
export const MEMBER_FEATURE_KEYS = [
  "pricing.features.member1",
  "pricing.features.member2",
  "pricing.features.member3",
  "pricing.features.member4",
  "pricing.features.member5",
  "pricing.features.member6",
] as const

export function planTitleKey(plan: MembershipPlan): "pricing.monthlyTitle" | "pricing.annualTitle" {
  return plan === "pro_monthly" ? "pricing.monthlyTitle" : "pricing.annualTitle"
}

export function planTaglineKey(
  plan: MembershipPlan,
): "pricing.monthlyTagline" | "pricing.annualTagline" {
  return plan === "pro_monthly" ? "pricing.monthlyTagline" : "pricing.annualTagline"
}

export function formatUsd(amount: number): string {
  return `$${amount.toFixed(2)}`
}

export function priceLabel(plan: MembershipPlan): string {
  const p = PLANS[plan]
  return `${formatUsd(p.price)}/${p.cadence === "month" ? "mo" : "yr"}`
}

/** What a full year costs if you stay on monthly — the high anchor. */
export function yearlyIfPaidMonthly(): number {
  return Math.round(PLANS.pro_monthly.price * 12 * 100) / 100
}

/** Annual price as a monthly equivalent, for the “just $X/mo” line. */
export function annualMonthlyEquivalent(): number {
  return Math.round((PLANS.premium_yearly.price / 12) * 100) / 100
}

export function annualSavingsVsMonthly(): number {
  return Math.round((yearlyIfPaidMonthly() - PLANS.premium_yearly.price) * 100) / 100
}

/** Whole months you don’t pay relative to staying monthly. */
export function annualMonthsFree(): number {
  const monthly = PLANS.pro_monthly.price
  if (monthly <= 0) return 0
  return Math.max(0, Math.floor(annualSavingsVsMonthly() / monthly + 1e-9))
}
