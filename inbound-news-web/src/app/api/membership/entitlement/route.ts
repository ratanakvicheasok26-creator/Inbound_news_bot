import { NextRequest, NextResponse } from "next/server"
import { authenticateRequest } from "@/lib/api-auth"
import { getUserMembership, getTrialProfileForUser } from "@/lib/membership-db"
import { isSupabaseConfigured } from "@/lib/supabase"
import { resolveEntitlement } from "@/lib/access"

/**
 * Combined membership + trial entitlement for the current user.
 * Returns the full entitlement state including trial countdown.
 */
export async function GET(req: NextRequest) {
  if (!isSupabaseConfigured) {
    return NextResponse.json({ entitlement: resolveEntitlement(null, null) }, { status: 200 })
  }

  const auth = await authenticateRequest(req)
  if (!auth) {
    return NextResponse.json({ entitlement: resolveEntitlement(null, null) }, { status: 200 })
  }

  const [membership, trialProfile] = await Promise.all([
    getUserMembership(auth.user.id),
    getTrialProfileForUser(auth.user.id),
  ])

  const entitlement = resolveEntitlement(membership, trialProfile)
  return NextResponse.json({ entitlement })
}

