import { createClient } from "@supabase/supabase-js"

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ""
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ""
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ""

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey)

/**
 * Service-role client — SERVER ONLY (Stripe webhook writes).
 * Never import this from a client component.
 */
export const supabaseAdmin =
  isSupabaseConfigured && serviceRoleKey
    ? createClient(supabaseUrl, serviceRoleKey, {
        auth: { autoRefreshToken: false, persistSession: false },
      })
    : null

/**
 * Server client impersonating the caller via their Supabase access token
 * (passed in the Authorization header). Uses the anon key + user JWT, so RLS
 * scopes every query to the authenticated user. No cookie/middleware needed.
 */
export function createUserClient(authorization: string | null) {
  return createClient(supabaseUrl || "https://placeholder.supabase.co", supabaseAnonKey || "placeholder-anon-key", {
    global: { headers: authorization ? { Authorization: authorization } : undefined },
    auth: { autoRefreshToken: false, persistSession: false },
  })
}
