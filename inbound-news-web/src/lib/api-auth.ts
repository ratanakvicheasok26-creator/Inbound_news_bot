import type { NextRequest } from "next/server"
import type { User } from "@supabase/supabase-js"
import { createUserClient, isSupabaseConfigured } from "./supabase-server"
import { canAccessTier, effectiveTier, hasPremiumAccess, type Feature, type PlanTier, type TrialProfile } from "./access"
import type { Membership } from "./stripe"

const MEMBERSHIP_COLUMNS =
  "user_id, plan, status, stripe_customer_id, stripe_subscription_id, current_period_start, current_period_end, cancel_at_period_end"

const PROFILE_TRIAL_COLUMNS = "trial_started_at, trial_ends_at, trial_used, membership_status"

/** Authenticate the caller from the Supabase access token in `Authorization`. */
export async function authenticateRequest(
  req: NextRequest,
): Promise<{ user: User; token: string } | null> {
  const authz = req.headers.get("authorization")
  if (!authz || !isSupabaseConfigured) return null
  const supabase = createUserClient(authz)
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()
  if (error || !user) return null
  return { user, token: authz.replace(/^Bearer\s+/i, "") }
}

/** Fetch the caller's own membership row for an already-authenticated request. */
export async function getMembershipForUser(auth: {
  user: User
  token: string
}): Promise<Membership | null> {
  const supabase = createUserClient(`Bearer ${auth.token}`)
  const { data } = await supabase
    .from("memberships")
    .select(MEMBERSHIP_COLUMNS)
    .eq("user_id", auth.user.id)
    .maybeSingle()
  return (data as Membership | null) ?? null
}

/** Fetch the caller's own trial profile data. */
export async function getTrialProfileForUser(auth: {
  user: User
  token: string
}): Promise<TrialProfile | null> {
  const supabase = createUserClient(`Bearer ${auth.token}`)
  const { data } = await supabase
    .from("profiles")
    .select(PROFILE_TRIAL_COLUMNS)
    .eq("id", auth.user.id)
    .maybeSingle()
  return (data as TrialProfile | null) ?? null
}

/** Fetch the caller's own membership row (RLS-scoped to the user). */
export async function getUserMembership(req: NextRequest): Promise<Membership | null> {
  const auth = await authenticateRequest(req)
  if (!auth) return null
  return getMembershipForUser(auth)
}

/** The caller's effective plan tier (free or pro — both paid plans map to "pro"). */
export async function getUserTier(req: NextRequest): Promise<PlanTier> {
  return effectiveTier(await getUserMembership(req))
}

/** True when the caller holds an active Pro or Premium subscription. */
export async function getUserHasPremiumAccess(req: NextRequest): Promise<boolean> {
  const auth = await authenticateRequest(req)
  if (!auth) return false
  const [membership, trialProfile] = await Promise.all([
    getMembershipForUser(auth),
    getTrialProfileForUser(auth),
  ])
  return hasPremiumAccess(membership, trialProfile)
}

/**
 * Server-side feature guard for protected API routes. Free users and guests
 * cannot bypass it by calling the endpoint directly.
 * Now considers both paid subscriptions and active trials.
 */
export async function requireFeature(
  req: NextRequest,
  feature: Feature,
): Promise<{ ok: true; tier: PlanTier } | { ok: false; status: number }> {
  const auth = await authenticateRequest(req)
  if (!auth) return { ok: false, status: 401 }

  const [membership, trialProfile] = await Promise.all([
    getMembershipForUser(auth),
    getTrialProfileForUser(auth),
  ])

  // Check paid subscription first
  const tier = effectiveTier(membership)
  if (canAccessTier(tier, feature)) return { ok: true, tier }

  // Check active trial — trial users get same access as paid
  if (trialProfile?.trial_ends_at) {
    const trialEnd = new Date(trialProfile.trial_ends_at).getTime()
    if (Number.isFinite(trialEnd) && trialEnd > Date.now()) {
      return { ok: true, tier: "pro" }
    }
  }

  return { ok: false, status: 403 }
}
