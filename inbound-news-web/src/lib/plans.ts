export type MembershipPlan = "pro_monthly" | "premium_yearly"

export function isActiveMembership(m: { status: string } | null | undefined): boolean {
  return Boolean(m && (m.status === "active" || m.status === "trialing"))
}

export const FREE_FEATURES = [
  "Daily clustered tech feed",
  "Reading tiers (ELI5 / Standard / Deep)",
  "Glossary with Khmer explanations",
  "Saved stories on your device",
  "Ads-supported",
]

export const PLANS: Record<
  MembershipPlan,
  { name: string; price: number; cadence: "month" | "year"; tagline: string }
> = {
  pro_monthly: {
    name: "Pro",
    price: 7.99,
    cadence: "month",
    tagline: "Full premium story access",
  },
  premium_yearly: {
    name: "Premium",
    price: 49.99,
    cadence: "year",
    tagline: "All Pro benefits, billed yearly",
  },
}

export const PLAN_FEATURES: Record<MembershipPlan, string[]> = {
  pro_monthly: [
    "Everything in Free",
    "Full access to premium stories",
    "New stories the moment they're published",
    "Funds independent coverage from Phnom Penh",
    "Cancel anytime",
  ],
  premium_yearly: [
    "Everything in Pro",
    "Billed yearly — about 48% off Pro monthly",
    "One simple annual bill",
    "Funds independent coverage from Phnom Penh",
    "Cancel anytime",
  ],
}

export function priceLabel(plan: MembershipPlan): string {
  const p = PLANS[plan]
  return `$${p.price.toFixed(2)}/${p.cadence === "month" ? "mo" : "yr"}`
}
