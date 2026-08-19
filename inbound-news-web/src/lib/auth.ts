import { supabase } from "./supabase"

export { supabase }

export async function signUp(email: string, password: string, displayName?: string) {
  return supabase.auth.signUp({
    email,
    password,
    options: {
      ...(displayName ? { data: { display_name: displayName } } : {}),
    },
  })
}

export async function signIn(email: string, password: string) {
  return supabase.auth.signInWithPassword({ email, password })
}

export async function signOut() {
  return supabase.auth.signOut()
}

export async function resetPassword(email: string) {
  const redirectTo =
    typeof window !== "undefined" ? `${window.location.origin}/reset-password` : undefined
  return supabase.auth.resetPasswordForEmail(email, redirectTo ? { redirectTo } : undefined)
}

export async function updatePassword(newPassword: string) {
  return supabase.auth.updateUser({ password: newPassword })
}
