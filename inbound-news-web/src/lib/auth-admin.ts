import { supabaseAdmin } from "@/lib/supabase-server"
import type { User } from "@supabase/supabase-js"

/**
 * Look up a user by email via the admin listUsers API.
 * Supabase JS v2.110 does not expose getUserByEmail on GoTrueAdminApi.
 */
export async function findUserByEmail(email: string): Promise<User | null> {
  if (!supabaseAdmin) return null

  const normalized = email.trim().toLowerCase()
  let page = 1
  const perPage = 1000

  while (page <= 20) {
    const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage })
    if (error) {
      console.error("[Auth] listUsers error:", error.message)
      return null
    }

    const match = data.users.find((u) => u.email?.toLowerCase() === normalized)
    if (match) return match

    if (data.users.length < perPage) break
    page++
  }

  return null
}
