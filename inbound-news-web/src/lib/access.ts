import type { Membership } from "./stripe"
import { isActiveMembership } from "./plans"

/**
 * Centralized plan-based feature authorization.
 *
 * The source of truth is the user's `memberships` row (paid subscriptions)
 * combined with `profiles` trial fields (42-day free trial). Everything that
 * gates a feature goes through here — client gates and server-side API checks
 * — so plan rules live in exactly one place.
 *
 * Pro ($7.99/mo) and Premium ($49.99/yr) are billing cadence alternatives —
 * both grant identical, full premium feature access. The distinction is
 * purely a pricing/billing choice, never a feature availability tier.
 *
 * A 42-day free trial grants the same feature access as a paid subscription.
 */

export type PlanTier = "free" | "pro"

/** High-level membership tier including trial states. */
export type MembershipTier = "PAID_PRO" | "PRO_TRIAL" | "EXPIRED" | "FREE"

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
  advanced_search: "free",
  local_lens: "pro",
  undercovered: "pro",
  trend_radar: "pro",
  basic_khmer_translation: "free",
  khmer_summary: "free",
  full_khmer_translation: "pro",
  unlimited_khmer_translation: "pro",
  khmer_decode: "pro",
  khmer_compare: "pro",
  khmer_daily_brief: "pro",
  khmer_coverage_intelligence: "pro",
  khmer_local_lens: "pro",
  khmer_trend_radar: "pro",
  khmer_intelligence_reports: "pro",
  khmer_historical_intelligence: "pro",
  khmer_premium_analysis: "pro",
}


/** Human-friendly feature names for locked / upgrade UI copy. */
export const FEATURE_LABELS: Record<Feature, string> = {
  full_decode: "Full Decode",
  advanced_compare: "Advanced Compare",
  daily_brief: "Personalized Daily Brief",
  bookmarks: "Bookmarks",
  advanced_search: "Advanced Search",
  local_lens: "Local Lens",
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
  khmer_local_lens: "Khmer Local Lens",
  khmer_trend_radar: "Khmer Trend Radar",
  khmer_intelligence_reports: "Khmer Intelligence Reports",
  khmer_historical_intelligence: "Khmer Historical Intelligence",
  khmer_premium_analysis: "Khmer Premium Analysis",
}

const TIER_RANK: Record<PlanTier, number> = { free: 0, pro: 1 }

/* ── Entitlement State ────────────────────────────────────────────────────── */

export interface EntitlementState {
  tier: MembershipTier
  hasProAccess: boolean
  trialStartedAt: string | null
  trialEndsAt: string | null
  daysRemaining: number
  isPaid: boolean
}

/** Profile trial fields from the profiles table. */
export interface TrialProfile {
  trial_started_at: string | null
  trial_ends_at: string | null
  trial_used: boolean
  membership_status: string
}

const EMPTY_ENTITLEMENT: EntitlementState = {
  tier: "FREE",
  hasProAccess: false,
  trialStartedAt: null,
  trialEndsAt: null,
  daysRemaining: 0,
  isPaid: false,
}

/**
 * Resolve the user's full entitlement state from their membership and profile.
 *
 * Priority:
 * 1. Active paid subscription → PAID_PRO
 * 2. Active 42-day trial (not expired) → PRO_TRIAL
 * 3. Expired trial → EXPIRED
 * 4. No trial, no subscription → FREE
 */
export function resolveEntitlement(
  membership: Membership | null | undefined,
  profile: TrialProfile | null | undefined,
): EntitlementState {
  // 1. Paid subscription takes absolute precedence
  if (membership && isActiveMembership(membership)) {
    return {
      tier: "PAID_PRO",
      hasProAccess: true,
      trialStartedAt: profile?.trial_started_at ?? null,
      trialEndsAt: profile?.trial_ends_at ?? null,
      daysRemaining: 0,
      isPaid: true,
    }
  }

  // 2. Check for an active trial
  if (profile?.trial_ends_at) {
    const now = Date.now()
    const trialEnd = new Date(profile.trial_ends_at).getTime()

    if (Number.isFinite(trialEnd)) {
      const diffMs = trialEnd - now
      const daysRemaining = Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)))

      if (diffMs > 0) {
        return {
          tier: "PRO_TRIAL",
          hasProAccess: true,
          trialStartedAt: profile.trial_started_at,
          trialEndsAt: profile.trial_ends_at,
          daysRemaining,
          isPaid: false,
        }
      }

      // Trial expired
      return {
        tier: "EXPIRED",
        hasProAccess: false,
        trialStartedAt: profile.trial_started_at,
        trialEndsAt: profile.trial_ends_at,
        daysRemaining: 0,
        isPaid: false,
      }
    }
  }

  // 3. No trial, no subscription
  return { ...EMPTY_ENTITLEMENT }
}

/* ── Plan Tier Resolution (backward-compatible) ───────────────────────────── */

/**
 * A user's effective plan tier, resolved from their Supabase membership.
 * Active + trialing memberships within the billing period count as paid;
 * expired / canceled / past_due / unpaid / incomplete rows drop back to Free.
 *
 * Both Pro ($7.99/mo) and Premium ($49.99/yr) map to "pro" — they grant
 * identical feature access. The plan name is a billing cadence, not an
 * access tier.
 */
export function effectiveTier(membership: Membership | null | undefined): PlanTier {
  if (!membership || !isActiveMembership(membership)) return "free"
  return "pro"
}

/**
 * Unified premium access check — true when the user holds an active
 * subscription on ANY paid plan (Pro monthly or Premium yearly) OR has
 * an active 42-day free trial.
 *
 * This is the single boolean helper that all feature gating should use.
 * Both Pro and Premium subscribers receive 100% identical premium access.
 * Trial users receive the same access as paid subscribers.
 */
export function hasPremiumAccess(
  membership: Membership | null | undefined,
  profile?: TrialProfile | null,
): boolean {
  // Paid subscription
  if (effectiveTier(membership) === "pro") return true
  // Active trial
  if (profile?.trial_ends_at) {
    const trialEnd = new Date(profile.trial_ends_at).getTime()
    if (Number.isFinite(trialEnd) && trialEnd > Date.now()) return true
  }
  return false
}

/** True when a resolved tier may use the feature. */
export function canAccessTier(tier: PlanTier, feature: Feature): boolean {
  return TIER_RANK[tier] >= TIER_RANK[FEATURE_TIER[feature]]
}

/** True when the given membership row may use the feature. */
export function canAccess(membership: Membership | null | undefined, feature: Feature): boolean {
  return canAccessTier(effectiveTier(membership), feature)
}

/**
 * True when the user can access a feature, considering both paid subscription
 * and active trial. This is the recommended check for feature gating.
 */
export function canAccessWithTrial(
  membership: Membership | null | undefined,
  feature: Feature,
  profile?: TrialProfile | null,
): boolean {
  if (hasPremiumAccess(membership, profile)) return true
  return canAccessTier("free", feature) || canAccessTier(effectiveTier(membership), feature)
}

/** Returns the minimum PlanTier required for a feature. */
export function requiredTier(feature: Feature): PlanTier {
  return FEATURE_TIER[feature]
}
