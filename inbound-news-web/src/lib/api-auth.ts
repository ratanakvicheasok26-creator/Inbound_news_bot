import type { NextRequest } from "next/server"
import type { User } from "@supabase/supabase-js"
import { verifyAccessToken, type AuthJWTPayload } from "./crypto"
import { getAccessTokenFromCookies } from "./session"
import { canAccessTier, effectiveTier, hasPremiumAccess, type Feature, type PlanTier, type TrialProfile } from "./access"
import type { Membership } from "./stripe"
import { getUserMembership as getMembership, getTrialProfileForUser } from "./membership-db"

export interface AuthenticatedUser {
  id: string
  email: string
  email_verified: boolean
}

export interface AuthContext {
  user: AuthenticatedUser
  token: string
}

export async function authenticateRequest(
  req: NextRequest,
): Promise<AuthContext | null> {
  let token: string | null = null

  const authz = req.headers.get("authorization")
  if (authz?.startsWith("Bearer ")) {
    token = authz.replace(/^Bearer\s+/i, "")
  }

  if (!token) {
    token = getAccessTokenFromCookies(req.headers.get("cookie"))
  }

  if (!token) return null

  const payload = await verifyAccessToken(token)
  if (!payload) return null

  return {
    user: {
      id: payload.sub!,
      email: payload.email as string,
      email_verified: payload.email_verified as boolean,
    },
    token,
  }
}

export async function getMembershipForUser(auth: {
  user: AuthenticatedUser
  token: string
}): Promise<Membership | null> {
  return getMembership(auth.user.id)
}

export async function getUserMembership(req: NextRequest): Promise<Membership | null> {
  const auth = await authenticateRequest(req)
  if (!auth) return null
  return getMembershipForUser(auth)
}

export async function getUserTier(req: NextRequest): Promise<PlanTier> {
  return effectiveTier(await getUserMembership(req))
}

export async function getUserHasPremiumAccess(req: NextRequest): Promise<boolean> {
  const auth = await authenticateRequest(req)
  if (!auth) return false
  const [membership, trialProfile] = await Promise.all([
    getMembershipForUser(auth),
    getTrialProfileForUser(auth.user.id),
  ])
  return hasPremiumAccess(membership, trialProfile)
}

export async function requireFeature(
  req: NextRequest,
  feature: Feature,
): Promise<{ ok: true; tier: PlanTier } | { ok: false; status: number }> {
  const auth = await authenticateRequest(req)
  if (!auth) return { ok: false, status: 401 }

  const [membership, trialProfile] = await Promise.all([
    getMembershipForUser(auth),
    getTrialProfileForUser(auth.user.id),
  ])

  const tier = effectiveTier(membership)
  if (canAccessTier(tier, feature)) return { ok: true, tier }

  if (trialProfile?.trial_ends_at) {
    const trialEnd = new Date(trialProfile.trial_ends_at).getTime()
    if (Number.isFinite(trialEnd) && trialEnd > Date.now()) {
      return { ok: true, tier: "pro" }
    }
  }

  return { ok: false, status: 403 }
}
