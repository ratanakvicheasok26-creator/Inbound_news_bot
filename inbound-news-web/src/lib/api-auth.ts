import type { NextRequest } from "next/server"
import type { User } from "@supabase/supabase-js"
import { createUserClient, isSupabaseConfigured } from "./supabase-server"
import { canAccessTier, effectiveTier, type Feature, type PlanTier } from "./access"
import type { Membership } from "./stripe"

const MEMBERSHIP_COLUMNS =
  "user_id, plan, status, stripe_customer_id, stripe_subscription_id, current_period_start, current_period_end, cancel_at_period_end"

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

/** Fetch the caller's own membership row (RLS-scoped to the user). */
export async function getUserMembership(req: NextRequest): Promise<Membership | null> {
  const auth = await authenticateRequest(req)
  if (!auth) return null
  return getMembershipForUser(auth)
}

/** The caller's effective plan tier (free / pro / premium). */
export async function getUserTier(req: NextRequest): Promise<PlanTier> {
  return effectiveTier(await getUserMembership(req))
}

/**
 * Server-side feature guard for protected API routes. Free users and guests
 * cannot bypass it by calling the endpoint directly.
 */
export async function requireFeature(
  req: NextRequest,
  feature: Feature,
): Promise<{ ok: true; tier: PlanTier } | { ok: false; status: number }> {
  const auth = await authenticateRequest(req)
  if (!auth) return { ok: false, status: 401 }
  const membership = await getMembershipForUser(auth)
  const tier = effectiveTier(membership)
  if (canAccessTier(tier, feature)) return { ok: true, tier }
  return { ok: false, status: 403 }
}
