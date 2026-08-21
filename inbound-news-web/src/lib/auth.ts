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
  status?: "created" | "verification_resent"
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

  if (msg.includes("already registered") || msg.includes("already been registered") || msg.includes("already exists")) {
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
  if (msg.includes("rate limit") || msg.includes("over_email_send_rate_limit")) {
    return { error: "Too many attempts. Please try again later." }
  }
  if (msg.includes("Password should be at least")) {
    return { error: msg }
  }
  if (msg.includes("expired") || msg.includes("Token has expired") || msg.includes("is expired")) {
    return { error: "This verification code has expired. Please request a new code." }
  }
  if (
    msg.includes("invalid") ||
    msg.includes("Token is invalid") ||
    msg.includes("Otp format is invalid") ||
    msg.includes("bad_code")
  ) {
    return { error: "The verification code is incorrect. Please try again." }
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
    const cleanEmail = email.trim().toLowerCase()

    const res = await fetch("/api/auth/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: cleanEmail,
        password,
        display_name: displayName?.trim() || "",
      }),
    })

    const payload = await res.json().catch(() => ({}))

    if (!res.ok) {
      return { data: null, error: { error: payload.error || "Signup failed. Please try again." } }
    }

    return {
      data: {
        user: {
          id: payload.user?.id || "",
          email: cleanEmail,
          email_verified: false,
          display_name: displayName?.trim() || null,
        },
        sessionCreated: false,
      },
      error: null,
    }
  } catch (e) {
    console.error("[Auth] signUp network error:", e)
    return { data: null, error: { error: "Network error. Please try again." } }
  }
}

export async function verifyOtp(
  email: string,
  token: string,
  password?: string,
): Promise<{ data: AuthResponse | null; error: AuthError | null }> {
  try {
    const cleanEmail = email.trim().toLowerCase()
    const cleanToken = token.trim()

    // 1. Verify custom 6-digit OTP code via API route
    const res = await fetch("/api/auth/verify-email-otp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: cleanEmail, token: cleanToken }),
    })

    const payload = await res.json().catch(() => ({}))

    if (res.ok) {
      if (password) {
        const { data: signInData, error: signInErr } = await supabase.auth.signInWithPassword({
          email: cleanEmail,
          password,
        })

        if (!signInErr && signInData?.user) {
          return {
            data: {
              user: extractAuthUser(signInData.user),
              sessionCreated: true,
            },
            error: null,
          }
        }
      }

      const { data: { user } } = await supabase.auth.getUser()

      return {
        data: {
          user: user ? extractAuthUser(user) : { id: "", email: cleanEmail, email_verified: true, display_name: null },
          sessionCreated: Boolean(user),
        },
        error: null,
      }
    }

    // 2. Fallback to Supabase native OTP verification
    const { data: sbData, error: sbError } = await supabase.auth.verifyOtp({
      email: cleanEmail,
      token: cleanToken,
      type: "signup",
    })

    if (!sbError && sbData?.user) {
      return {
        data: {
          user: extractAuthUser(sbData.user),
          sessionCreated: true,
        },
        error: null,
      }
    }

    return {
      data: null,
      error: { error: payload.error || (sbError ? mapSupabaseError(sbError).error : "Verification failed. Please try again.") },
    }
  } catch (e) {
    console.error("[Auth] verifyOtp network error:", e)
    return { data: null, error: { error: "Network error. Please try again." } }
  }
}

export async function resendOtp(
  email: string,
): Promise<{ error: AuthError | null }> {
  try {
    const cleanEmail = email.trim().toLowerCase()

    // 1. Prioritize custom API route (generates consistent 6-digit code via Gmail/Resend)
    const res = await fetch("/api/auth/resend-verification", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: cleanEmail }),
    })

    if (res.ok) {
      return { error: null }
    }

    const payload = await res.json().catch(() => ({}))

    // 2. Fallback to Supabase native resend if API route fails
    const { error: sbError } = await supabase.auth.resend({
      type: "signup",
      email: cleanEmail,
    })

    if (!sbError) {
      return { error: null }
    }

    return {
      error: {
        error: payload.error || mapSupabaseError(sbError).error || "Failed to resend code",
      },
    }
  } catch (e) {
    console.error("[Auth] resendOtp network error:", e)
    return { error: { error: "We couldn't send a new verification code. Please try again later." } }
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
    const res = await fetch("/api/auth/forgot-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: email.trim().toLowerCase() }),
    })

    if (!res.ok) {
      const payload = await res.json().catch(() => ({}))
      return { error: { error: payload.error || "Network error. Please try again." } }
    }

    return { error: null }
  } catch {
    return { error: { error: "Network error. Please try again." } }
  }
}

export async function resendVerification(
  email: string,
): Promise<{ error: AuthError | null }> {
  try {
    const res = await fetch("/api/auth/resend-verification", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: email.trim().toLowerCase() }),
    })

    if (!res.ok) {
      const payload = await res.json().catch(() => ({}))
      return { error: { error: payload.error || "Network error. Please try again." } }
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
