import { NextRequest, NextResponse } from "next/server"
import { getUserMembership } from "@/lib/api-auth"
import { authenticateRequest } from "@/lib/api-auth"
import { isSupabaseConfigured } from "@/lib/supabase"

/** Current membership + trial info for the signed-in user (JWT via Authorization header). */
export async function GET(req: NextRequest) {
  const membership = await getUserMembership(req)

  // Also fetch trial profile data
  let trial: { trial_started_at: string | null; trial_ends_at: string | null; trial_used: boolean; membership_status: string } | null = null

  if (isSupabaseConfigured) {
    const auth = await authenticateRequest(req)
    if (auth) {
      const authz = req.headers.get("authorization")
      if (authz) {
        const { createUserClient } = await import("@/lib/supabase-server")
        const userClient = createUserClient(authz)
        const { data } = await userClient
          .from("profiles")
          .select("trial_started_at, trial_ends_at, trial_used, membership_status")
          .eq("id", auth.user.id)
          .maybeSingle()
        trial = data
      }
    }
  }

  return NextResponse.json({ membership, trial })
}
