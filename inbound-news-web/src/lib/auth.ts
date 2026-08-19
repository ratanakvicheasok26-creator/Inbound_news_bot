import { supabase } from "./supabase"

export { supabase }

export interface AuthUser {
  id: string
  email: string
  email_verified: boolean
  display_name: string | null
  created_at?: string
  user_metadata?: Record<string, unknown>
}

export interface AuthResponse {
  user: AuthUser
  sessionCreated: boolean
}

export interface AuthError {
  error: string
  retryAfterMs?: number
  score?: number
  feedback?: string
  breachCount?: number
}

function mapSupabaseError(error: { message: string; code?: string }): AuthError {
  const msg = error.message || "An unexpected error occurred"

  if (msg.includes("already registered") || msg.includes("already been registered")) {
    return { error: "An account with this email already exists" }
  }
  if (msg.includes("Invalid login credentials")) {
    return { error: "Invalid email or password" }
  }
  if (msg.includes("Email not confirmed")) {
    return { error: "Please confirm your email before signing in. Check your inbox." }
  }
  if (msg.includes("User not found")) {
    return { error: "No account found with this email" }
  }
  if (msg.includes("rate limit")) {
    return { error: "Too many attempts. Please try again later." }
  }
  if (msg.includes("Password should be at least")) {
    return { error: msg }
  }

  console.error("[Auth] Supabase error:", error)
  return { error: msg }
}

function extractAuthUser(supabaseUser: {
  id: string
  email?: string
  email_confirmed_at?: string | null
  created_at?: string
  user_metadata?: Record<string, unknown>
  app_metadata?: Record<string, unknown>
}): AuthUser {
  return {
    id: supabaseUser.id,
    email: supabaseUser.email || "",
    email_verified: !!supabaseUser.email_confirmed_at,
    display_name:
      (supabaseUser.user_metadata?.display_name as string) || null,
    created_at: supabaseUser.created_at,
    user_metadata: supabaseUser.user_metadata,
  }
}

export async function signUp(
  email: string,
  password: string,
  displayName?: string,
): Promise<{ data: AuthResponse | null; error: AuthError | null }> {
  try {
    const redirectTo =
      typeof window !== "undefined"
        ? `${window.location.origin}/auth/callback`
        : undefined

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: redirectTo,
        data: {
          display_name: displayName || "",
        },
      },
    })

    if (error) {
      console.error("[Auth] signUp error:", error)
      return { data: null, error: mapSupabaseError(error) }
    }

    if (!data.user) {
      return { data: null, error: { error: "Signup failed. Please try again." } }
    }

    if (data.user.identities && data.user.identities.length === 0) {
      return { data: null, error: { error: "An account with this email already exists" } }
    }

    return {
      data: { user: extractAuthUser(data.user), sessionCreated: !!data.session },
      error: null,
    }
  } catch (e) {
    console.error("[Auth] signUp network error:", e)
    return { data: null, error: { error: "Network error. Please try again." } }
  }
}

export async function signIn(
  email: string,
  password: string,
): Promise<{ data: AuthResponse | null; error: AuthError | null }> {
  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (error) {
      console.error("[Auth] signIn error:", error)
      return { data: null, error: mapSupabaseError(error) }
    }

    if (!data.user) {
      return { data: null, error: { error: "Login failed. Please try again." } }
    }

    return {
      data: { user: extractAuthUser(data.user), sessionCreated: true },
      error: null,
    }
  } catch (e) {
    console.error("[Auth] signIn network error:", e)
    return { data: null, error: { error: "Network error. Please try again." } }
  }
}

export async function signOut(): Promise<{ error: AuthError | null }> {
  try {
    const { error } = await supabase.auth.signOut()
    if (error) {
      console.error("[Auth] signOut error:", error)
      return { error: { error: "Failed to sign out" } }
    }
    return { error: null }
  } catch {
    return { error: { error: "Failed to sign out" } }
  }
}

export async function resetPassword(
  email: string,
): Promise<{ error: AuthError | null }> {
  try {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/callback?next=/reset-password`,
    })
    if (error) {
      console.error("[Auth] resetPassword error:", error)
      return { error: mapSupabaseError(error) }
    }
    return { error: null }
  } catch {
    return { error: { error: "Network error. Please try again." } }
  }
}

export async function updatePassword(
  newPassword: string,
): Promise<{ error: AuthError | null }> {
  try {
    const { error } = await supabase.auth.updateUser({
      password: newPassword,
    })
    if (error) {
      console.error("[Auth] updatePassword error:", error)
      return { error: mapSupabaseError(error) }
    }
    return { error: null }
  } catch {
    return { error: { error: "Network error. Please try again." } }
  }
}

export async function getCurrentUser(): Promise<AuthUser | null> {
  try {
    const { data: { user }, error } = await supabase.auth.getUser()
    if (error || !user) return null
    return extractAuthUser(user)
  } catch {
    return null
  }
}

export async function refreshSession(): Promise<boolean> {
  try {
    const { error } = await supabase.auth.getSession()
    return !error
  } catch {
    return false
  }
}

export async function changePassword(
  newPassword: string,
): Promise<{ error: AuthError | null }> {
  return updatePassword(newPassword)
}

export async function requestEmailChange(
  newEmail: string,
): Promise<{ error: AuthError | null }> {
  try {
    const { error } = await supabase.auth.updateUser({ email: newEmail })
    if (error) {
      console.error("[Auth] requestEmailChange error:", error)
      return { error: mapSupabaseError(error) }
    }
    return { error: null }
  } catch {
    return { error: { error: "Network error. Please try again." } }
  }
}
