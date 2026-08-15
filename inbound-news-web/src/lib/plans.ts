export type MembershipPlan = "pro_monthly" | "premium_yearly"

export function isActiveMembership(m: { status: string } | null | undefined): boolean {
  return Boolean(m && (m.status === "active" || m.status === "trialing"))
}

export const FREE_FEATURES = [
  "Latest technology news and all categories",
  "Basic search, summaries, Coverage Intensity, and Glossary",
  "Selected Cambodia and Southeast Asia news",
  "Sponsored content",
  "Limited access to advanced features",
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
    "Full Decode — what happened, why it matters, and key takeaways",
    "Advanced Compare and Coverage Intelligence",
    "Personalized Daily Brief",
    "Bookmarks and advanced search",
    "Sponsored content remains visible",
  ],
  premium_yearly: [
    "Everything in Pro",
    "Premium Local Lens for Cambodia and Southeast Asia",
    "Undercovered Stories and Trend Radar",
    "Premium Intelligence Reports",
    "Historical Intelligence and coverage trends",
    "Exclusive premium analysis",
    "Sponsored content remains visible",
  ],
}

export function priceLabel(plan: MembershipPlan): string {
  const p = PLANS[plan]
  return `$${p.price.toFixed(2)}/${p.cadence === "month" ? "mo" : "yr"}`
}
