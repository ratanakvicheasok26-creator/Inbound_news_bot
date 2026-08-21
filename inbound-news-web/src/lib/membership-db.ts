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

  if (!data) return null

  let profile = data as TrialProfile

  // Auto-enrollment safety net for existing accounts without trial records:
  // If trial_started_at is null, check if they have an active paid membership.
  // If not paid, enroll them into the 42-day free trial.
  if (!profile.trial_started_at) {
    const { data: paidMembership } = await supabase
      .from("memberships")
      .select("status, current_period_end")
      .eq("user_id", userId)
      .maybeSingle()

    const isPaid =
      paidMembership &&
      (paidMembership.status === "active" || paidMembership.status === "trialing") &&
      (!paidMembership.current_period_end ||
        new Date(paidMembership.current_period_end).getTime() > Date.now())

    if (!isPaid && profile.membership_status !== "pro") {
      const now = new Date()
      const endsAt = new Date(now.getTime() + 42 * 24 * 60 * 60 * 1000)
      const nowIso = now.toISOString()
      const endsAtIso = endsAt.toISOString()

      const { data: updated } = await supabase
        .from("profiles")
        .update({
          trial_started_at: nowIso,
          trial_ends_at: endsAtIso,
          trial_used: true,
          membership_status: "trial",
          updated_at: nowIso,
        })
        .eq("id", userId)
        .select(PROFILE_TRIAL_COLUMNS)
        .single()

      if (updated) {
        profile = updated as TrialProfile
      } else {
        profile = {
          trial_started_at: nowIso,
          trial_ends_at: endsAtIso,
          trial_used: true,
          membership_status: "trial",
        }
      }
    }
  }

  return profile
}
