"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { supabase, updatePassword, signOut } from "@/lib/auth"
import {
  AuthShell,
  AuthError,
  AuthSuccess,
  PasswordInput,
} from "@/components/auth/AuthShell"

export default function ResetPasswordPage() {
  const router = useRouter()
  const [ready, setReady] = useState(false)
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")

  useEffect(() => {
    let mounted = true
    async function checkSession() {
      const { data } = await supabase.auth.getSession()
      if (!mounted) return
      if (data.session) setReady(true)
    }
    checkSession()
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (!mounted) return
      if (event === "PASSWORD_RECOVERY" && session) setReady(true)
    })
    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError("")
    setSuccess("")

    if (password.length < 8) {
      setError("Password must be at least 8 characters.")
      return
    }
    if (!/[A-Z]/.test(password) || !/[a-z]/.test(password) || !/[0-9]/.test(password) || !/[^A-Za-z0-9]/.test(password)) {
      setError("Password needs upper + lower + number + special character.")
      return
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match.")
      return
    }

    setLoading(true)
    try {
      const { error: authError } = await updatePassword(password)
      if (authError) {
        setError(authError.message)
        return
      }
      await signOut()
      setSuccess("Password updated. You can now sign in with your new password.")
      setTimeout(() => router.push("/login"), 1200)
    } catch {
      setError("Something went wrong. Try again.")
    } finally {
      setLoading(false)
    }
  }

  if (!ready) {
    return (
      <AuthShell title="Create new password" subtitle="Set a new password for your account.">
        <AuthError message={error || "This reset link is invalid or has expired. Request a new one."} />
        <div className="mt-4 text-center">
          <Link
            href="/forgot-password"
            className="text-[13px] font-semibold text-[var(--text-primary)] hover:text-[var(--accent)]"
          >
            Request a new reset link
          </Link>
        </div>
      </AuthShell>
    )
  }

  return (
    <AuthShell title="Create new password" subtitle="Set a new password for your account.">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="meta-text block mb-2">New password</label>
          <PasswordInput
            required
            autoComplete="new-password"
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Min 8 characters, upper + lower + number + special"
          />
        </div>

        <div>
          <label className="meta-text block mb-2">Confirm new password</label>
          <PasswordInput
            required
            autoComplete="new-password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="Repeat your new password"
          />
        </div>

        <AuthError message={error} />
        <AuthSuccess message={success} />

        <button type="submit" disabled={loading} className="btn-primary w-full h-11 disabled:opacity-50">
          {loading ? "Updating…" : "Update password"}
        </button>
      </form>
    </AuthShell>
  )
}
