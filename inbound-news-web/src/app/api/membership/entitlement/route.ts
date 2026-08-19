import { NextRequest, NextResponse } from "next/server"
import { authenticateRequest, getMembershipForUser } from "@/lib/api-auth"
import { isSupabaseConfigured, supabase as anonSupabase } from "@/lib/supabase"
import { resolveEntitlement, type TrialProfile } from "@/lib/access"
import type { SupabaseClient } from "@supabase/supabase-js"

/**
 * Combined membership + trial entitlement for the current user.
 * Returns the full entitlement state including trial countdown.
 */
export async function GET(req: NextRequest) {
  if (!isSupabaseConfigured) {
    return NextResponse.json({ entitlement: null }, { status: 200 })
  }

  const auth = await authenticateRequest(req)
  if (!auth) {
    return NextResponse.json({ entitlement: null }, { status: 200 })
  }

  const membership = await getMembershipForUser(auth)

  // Fetch trial profile data using the user's JWT-scoped client
  const authz = req.headers.get("authorization")
  const userClient: SupabaseClient = authz
    ? (await import("@/lib/supabase-server")).createUserClient(authz)
    : anonSupabase

  const { data: profile } = await userClient
    .from("profiles")
    .select("trial_started_at, trial_ends_at, trial_used, membership_status")
    .eq("id", auth.user.id)
    .maybeSingle()

  const trialProfile = (profile as TrialProfile | null) ?? null
  const entitlement = resolveEntitlement(membership, trialProfile)

  return NextResponse.json({ entitlement })
}
