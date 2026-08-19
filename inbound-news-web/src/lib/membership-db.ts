import { createClient } from "@supabase/supabase-js"
import type { Membership } from "./stripe"
import type { TrialProfile } from "./access"

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ""
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ""

const MEMBERSHIP_COLUMNS =
  "user_id, plan, status, stripe_customer_id, stripe_subscription_id, current_period_start, current_period_end, cancel_at_period_end"

const PROFILE_TRIAL_COLUMNS = "trial_started_at, trial_ends_at, trial_used, membership_status"

function getServiceClient() {
  if (!supabaseUrl || !serviceRoleKey) return null
  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

export async function getUserMembership(userId: string): Promise<Membership | null> {
  const supabase = getServiceClient()
  if (!supabase) return null

  const { data } = await supabase
    .from("memberships")
    .select(MEMBERSHIP_COLUMNS)
    .eq("user_id", userId)
    .maybeSingle()

  return (data as Membership | null) ?? null
}

export async function getTrialProfileForUser(userId: string): Promise<TrialProfile | null> {
  const supabase = getServiceClient()
  if (!supabase) return null

  const { data } = await supabase
    .from("profiles")
    .select(PROFILE_TRIAL_COLUMNS)
    .eq("id", userId)
    .maybeSingle()

  return (data as TrialProfile | null) ?? null
}
