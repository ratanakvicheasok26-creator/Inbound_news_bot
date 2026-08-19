import type { SupabaseClient } from "@supabase/supabase-js"
import type { Membership } from "./stripe"
import { resolveEntitlement, type EntitlementState, type TrialProfile } from "./access"

const MEMBERSHIP_COLUMNS =
  "user_id, plan, status, stripe_customer_id, stripe_subscription_id, current_period_start, current_period_end, cancel_at_period_end"

const PROFILE_TRIAL_COLUMNS = "trial_started_at, trial_ends_at, trial_used, membership_status"

/**
 * Server-side entitlement resolution. Fetches both membership and profile
 * trial data, then returns the combined entitlement state.
 *
 * Use this in API routes and server components.
 */
export async function getUserEntitlement(
  supabase: SupabaseClient,
  userId: string,
): Promise<EntitlementState> {
  const [membershipResult, profileResult] = await Promise.all([
    supabase
      .from("memberships")
      .select(MEMBERSHIP_COLUMNS)
      .eq("user_id", userId)
      .maybeSingle(),
    supabase
      .from("profiles")
      .select(PROFILE_TRIAL_COLUMNS)
      .eq("id", userId)
      .maybeSingle(),
  ])

  const membership = (membershipResult.data as Membership | null) ?? null
  const profile = (profileResult.data as TrialProfile | null) ?? null

  return resolveEntitlement(membership, profile)
}

/**
 * Lightweight check: does the user have Pro access (paid or trial)?
 * Useful for quick boolean guards without full entitlement state.
 */
export async function userHasProAccess(
  supabase: SupabaseClient,
  userId: string,
): Promise<boolean> {
  const entitlement = await getUserEntitlement(supabase, userId)
  return entitlement.hasProAccess
}
