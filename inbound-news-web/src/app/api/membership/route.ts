import { NextRequest, NextResponse } from "next/server"
import { authenticateRequest } from "@/lib/api-auth"
import { getUserMembership, getTrialProfileForUser } from "@/lib/membership-db"
import { isSupabaseConfigured } from "@/lib/supabase"

/** Current membership + trial info for the signed-in user. */
export async function GET(req: NextRequest) {
  if (!isSupabaseConfigured) {
    return NextResponse.json({ membership: null, trial: null })
  }

  const auth = await authenticateRequest(req)
  if (!auth) {
    return NextResponse.json({ membership: null, trial: null })
  }

  const [membership, trial] = await Promise.all([
    getUserMembership(auth.user.id),
    getTrialProfileForUser(auth.user.id),
  ])

  return NextResponse.json({ membership, trial })
}

