import { createServerClient as createSupabaseServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"

/**
 * Creates a Supabase client for use in Server Components, Route Handlers, and
 * Server Actions. Reads/writes the `sb-<ref>-auth-token` cookie automatically.
 */
export async function createServerClient() {
  const cookieStore = await cookies()

  return createSupabaseServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || "",
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "",
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet: { name: string; value: string; options?: Record<string, unknown> }[]) {
          try {
            for (const { name, value, options } of cookiesToSet) {
              cookieStore.set(name, value, options)
            }
          } catch {
            // `setAll` is called from a Server Component — cookies are read-only.
            // This is expected when the cookie is being set from a middleware or
            // redirect response; the browser will handle it.
          }
        },
      },
    },
  )
}
