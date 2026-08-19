import type { NextRequest } from "next/server"
import { createClient } from "@supabase/supabase-js"
import type { Membership } from "./stripe"
import { effectiveTier, hasPremiumAccess, type Feature, type PlanTier, type TrialProfile } from "./access"
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

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ""
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ""

function parseCookies(cookieHeader: string): Map<string, string> {
  const cookies = new Map<string, string>()
  for (const pair of cookieHeader.split(";")) {
    const [name, ...rest] = pair.split("=")
    if (name && rest.length > 0) {
      cookies.set(name.trim(), rest.join("=").trim())
    }
  }
  return cookies
}

function findSupabaseAccessToken(cookies: Map<string, string>): string | null {
  let baseName: string | null = null
  for (const name of cookies.keys()) {
    if (name.startsWith("sb-") && name.endsWith("-auth-token")) {
      baseName = name
      break
    }
  }
  if (!baseName) return null

  const chunks: string[] = []
  if (cookies.has(baseName)) chunks.push(cookies.get(baseName)!)
  for (let i = 0; cookies.has(`${baseName}.${i}`); i++) {
    chunks.push(cookies.get(`${baseName}.${i}`)!)
  }
  if (chunks.length === 0) return null

  let raw = chunks.join("")
  if (raw.startsWith("base64-")) raw = raw.slice(7)
  const b64 = raw.replace(/-/g, "+").replace(/_/g, "/")
  try {
    const decoded = JSON.parse(atob(b64))
    return decoded.access_token || null
  } catch {
    return null
  }
}

/**
 * Verify a Supabase access token by calling the Supabase Auth API.
 * This avoids needing SUPABASE_JWT_SECRET locally.
 */
async function verifyToken(token: string): Promise<AuthenticatedUser | null> {
  try {
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      auth: { autoRefreshToken: false, persistSession: false },
      global: { headers: { Authorization: `Bearer ${token}` } },
    })

    const { data: { user }, error } = await supabase.auth.getUser()
    if (error || !user) return null

    return {
      id: user.id,
      email: user.email || "",
      email_verified: !!user.email_confirmed_at,
    }
  } catch {
    return null
  }
}

export async function authenticateRequest(
  req: NextRequest,
): Promise<AuthContext | null> {
  const authz = req.headers.get("authorization")
  if (authz?.startsWith("Bearer ")) {
    const token = authz.replace(/^Bearer\s+/i, "")
    const user = await verifyToken(token)
    if (user) return { user, token }
  }

  const cookieHeader = req.headers.get("cookie")
  if (!cookieHeader) return null

  const cookies = parseCookies(cookieHeader)
  const accessToken = findSupabaseAccessToken(cookies)
  if (!accessToken) return null

  const user = await verifyToken(accessToken)
  if (!user) return null

  return { user, token: accessToken }
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
  if (hasPremiumAccess(membership, trialProfile)) return { ok: true, tier: "pro" }

  return { ok: false, status: 403 }
}
