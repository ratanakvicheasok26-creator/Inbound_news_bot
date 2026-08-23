import { createClient, type SupabaseClient, type User } from "npm:@supabase/supabase-js@2"

export function adminClient(): SupabaseClient {
  const url = Deno.env.get("SUPABASE_URL") ?? ""
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
  if (!url || !key) {
    throw new Error("SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY are not configured")
  }
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

export async function userFromRequest(req: Request): Promise<User | null> {
  const auth = req.headers.get("Authorization") ?? ""
  if (!auth.toLowerCase().startsWith("bearer ")) return null
  const url = Deno.env.get("SUPABASE_URL") ?? ""
  const anon = Deno.env.get("SUPABASE_ANON_KEY") ?? ""
  if (!url || !anon) return null
  const client = createClient(url, anon, {
    global: { headers: { Authorization: auth } },
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const { data, error } = await client.auth.getUser()
  if (error || !data.user) return null
  return data.user
}
