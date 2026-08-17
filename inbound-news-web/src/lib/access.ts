import type { Membership } from "./stripe"
import { isActiveMembership } from "./plans"

/**
 * Centralized plan-based feature authorization.
 *
 * The source of truth is the user's `memberships` row in Supabase
 * (plan + status + billing period). Everything that gates a feature goes
 * through here — client gates and server-side API checks — so plan rules
 * live in exactly one place.
 */

export type PlanTier = "free" | "pro" | "premium"

/** Every feature that can be gated behind a paid plan. */
export type Feature =
  | "full_decode"
  | "advanced_compare"
  | "daily_brief"
  | "bookmarks"
  | "advanced_search"
  | "local_lens"
  | "undercovered"
  | "trend_radar"
  // Khmer AI content — the Khmer UI itself is free; these gate AI-generated
  // Khmer translations / analyses. Same central system, same server checks.
  | "basic_khmer_translation"
  | "khmer_summary"
  | "full_khmer_translation"
  | "unlimited_khmer_translation"
  | "khmer_decode"
  | "khmer_compare"
  | "khmer_daily_brief"
  | "khmer_coverage_intelligence"
  | "khmer_local_lens"
  | "khmer_trend_radar"
  | "khmer_intelligence_reports"
  | "khmer_historical_intelligence"
  | "khmer_premium_analysis"

/** Minimum plan tier required for each feature. */
const FEATURE_TIER: Record<Feature, PlanTier> = {
  full_decode: "pro",
  advanced_compare: "pro",
  daily_brief: "pro",
  bookmarks: "pro",
  advanced_search: "pro",
  local_lens: "premium",
  undercovered: "premium",
  trend_radar: "premium",
  // Khmer content — free tier gets limited translation + basic summaries.
  basic_khmer_translation: "free",
  khmer_summary: "free",
  full_khmer_translation: "pro",
  unlimited_khmer_translation: "premium",
  khmer_decode: "pro",
  khmer_compare: "pro",
  khmer_daily_brief: "pro",
  khmer_coverage_intelligence: "pro",
  khmer_local_lens: "premium",
  khmer_trend_radar: "premium",
  khmer_intelligence_reports: "premium",
  khmer_historical_intelligence: "premium",
  khmer_premium_analysis: "premium",
}

/** Human-friendly feature names for locked / upgrade UI copy. */
export const FEATURE_LABELS: Record<Feature, string> = {
  full_decode: "Full Decode",
  advanced_compare: "Advanced Compare",
  daily_brief: "Personalized Daily Brief",
  bookmarks: "Bookmarks",
  advanced_search: "Advanced Search",
  local_lens: "Premium Local Lens",
  undercovered: "Undercovered Stories",
  trend_radar: "Trend Radar",
  basic_khmer_translation: "Basic Khmer Translation",
  khmer_summary: "Khmer Summaries",
  full_khmer_translation: "Full Khmer Translation",
  unlimited_khmer_translation: "Unlimited Khmer Translation",
  khmer_decode: "Full Khmer Decode",
  khmer_compare: "Khmer Advanced Compare",
  khmer_daily_brief: "Khmer Daily Brief",
  khmer_coverage_intelligence: "Khmer Coverage Intelligence",
  khmer_local_lens: "Premium Khmer Local Lens",
  khmer_trend_radar: "Khmer Trend Radar",
  khmer_intelligence_reports: "Khmer Intelligence Reports",
  khmer_historical_intelligence: "Khmer Historical Intelligence",
  khmer_premium_analysis: "Khmer Premium Analysis",
}

export const TIER_LABELS: Record<PlanTier, string> = {
  free: "Free",
  pro: "Pro",
  premium: "Premium",
}

const TIER_RANK: Record<PlanTier, number> = { free: 0, pro: 1, premium: 2 }

/** The plan tier a given feature requires. */
export function requiredTier(feature: Feature): PlanTier {
  return FEATURE_TIER[feature]
}

/**
 * A user's effective plan tier, resolved from their Supabase membership.
 * Active + trialing memberships within the billing period count as paid;
 * expired / canceled / past_due / unpaid / incomplete rows drop back to Free.
 */
export function effectiveTier(membership: Membership | null | undefined): PlanTier {
  if (!membership || !isActiveMembership(membership)) return "free"
  return membership.plan === "premium_yearly" ? "premium" : "pro"
}

/** True when a resolved tier may use the feature. */
export function canAccessTier(tier: PlanTier, feature: Feature): boolean {
  return TIER_RANK[tier] >= TIER_RANK[FEATURE_TIER[feature]]
}

/** True when the given membership row may use the feature. */
export function canAccess(membership: Membership | null | undefined, feature: Feature): boolean {
  return canAccessTier(effectiveTier(membership), feature)
}
