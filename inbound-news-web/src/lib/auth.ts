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
  access_token: string
}

export interface AuthError {
  error: string
  retryAfterMs?: number
  score?: number
  feedback?: string
  breachCount?: number
}

function getBaseUrl(): string {
  if (typeof window !== "undefined") return ""
  return process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"
}

async function authFetch(
  path: string,
  options: RequestInit = {},
): Promise<Response> {
  const base = getBaseUrl()
  return fetch(`${base}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...options.headers,
    },
  })
}

export async function signUp(
  email: string,
  password: string,
  displayName?: string,
): Promise<{ data: AuthResponse | null; error: AuthError | null }> {
  try {
    const res = await authFetch("/api/auth/signup", {
      method: "POST",
      body: JSON.stringify({
        email,
        password,
        display_name: displayName,
      }),
    })

    const data = await res.json()

    if (!res.ok) {
      return { data: null, error: data as AuthError }
    }

    return { data: data as AuthResponse, error: null }
  } catch {
    return { data: null, error: { error: "Network error. Please try again." } }
  }
}

export async function signIn(
  email: string,
  password: string,
): Promise<{ data: AuthResponse | null; error: AuthError | null }> {
  try {
    const res = await authFetch("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    })

    const data = await res.json()

    if (!res.ok) {
      return { data: null, error: data as AuthError }
    }

    return { data: data as AuthResponse, error: null }
  } catch {
    return { data: null, error: { error: "Network error. Please try again." } }
  }
}

export async function signOut(): Promise<{ error: AuthError | null }> {
  try {
    await authFetch("/api/auth/logout", { method: "POST" })
    return { error: null }
  } catch {
    return { error: { error: "Failed to sign out" } }
  }
}

export async function resetPassword(
  email: string,
): Promise<{ error: AuthError | null }> {
  try {
    const res = await authFetch("/api/auth/forgot-password", {
      method: "POST",
      body: JSON.stringify({ email }),
    })

    const data = await res.json()

    if (!res.ok) {
      return { error: data as AuthError }
    }

    return { error: null }
  } catch {
    return { error: { error: "Network error. Please try again." } }
  }
}

export async function updatePassword(
  token: string,
  password: string,
): Promise<{ error: AuthError | null }> {
  try {
    const res = await authFetch("/api/auth/reset-password", {
      method: "POST",
      body: JSON.stringify({ token, password }),
    })

    const data = await res.json()

    if (!res.ok) {
      return { error: data as AuthError }
    }

    return { error: null }
  } catch {
    return { error: { error: "Network error. Please try again." } }
  }
}

export async function changePassword(
  newPassword: string,
): Promise<{ error: AuthError | null }> {
  try {
    const res = await authFetch("/api/auth/change-password", {
      method: "POST",
      body: JSON.stringify({ password: newPassword }),
    })

    const data = await res.json()

    if (!res.ok) {
      return { error: data as AuthError }
    }

    return { error: null }
  } catch {
    return { error: { error: "Network error. Please try again." } }
  }
}

export async function requestEmailChange(
  newEmail: string,
): Promise<{ error: AuthError | null }> {
  try {
    const res = await authFetch("/api/auth/change-email", {
      method: "POST",
      body: JSON.stringify({ new_email: newEmail }),
    })

    const data = await res.json()

    if (!res.ok) {
      return { error: data as AuthError }
    }

    return { error: null }
  } catch {
    return { error: { error: "Network error. Please try again." } }
  }
}

export async function getCurrentUser(): Promise<AuthUser | null> {
  try {
    const res = await authFetch("/api/auth/me", {
      credentials: "include",
    })

    if (!res.ok) return null

    const data = await res.json()
    return data.user || null
  } catch {
    return null
  }
}

export async function refreshSession(): Promise<boolean> {
  try {
    const res = await authFetch("/api/auth/refresh", {
      method: "POST",
      credentials: "include",
    })
    return res.ok
  } catch {
    return false
  }
}
