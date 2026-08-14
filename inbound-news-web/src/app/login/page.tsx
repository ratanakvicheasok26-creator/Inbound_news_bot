"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { signIn } from "@/lib/auth"
import {
  AuthShell,
  AuthError,
  AuthSuccess,
  PasswordInput,
  authInputClass,
} from "@/components/auth/AuthShell"

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")

  function afterSignIn() {
    const params = new URLSearchParams(window.location.search)
    const returnTo = params.get("returnTo")
    if (returnTo && returnTo.startsWith("/") && !returnTo.startsWith("//")) {
      router.push(returnTo)
    } else {
      router.push("/account")
    }
    router.refresh()
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError("")
    setSuccess("")
    setLoading(true)

    try {
      const { error: authError } = await signIn(email.trim(), password)
      if (authError) {
        setError(authError.message)
      } else {
        afterSignIn()
      }
    } catch {
      setError("Something went wrong. Try again.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthShell
      title="Sign in"
      subtitle="Welcome back. Preferences sync when signed in; library and score stay on this device."
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="meta-text block mb-2">Email</label>
          <input
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={authInputClass}
            placeholder="you@example.com"
          />
        </div>

        <div>
          <label className="meta-text block mb-2">Password</label>
          <PasswordInput
            required
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Your password"
          />
        </div>

        <div className="flex justify-end">
          <Link
            href="/forgot-password"
            className="text-[13px] text-[var(--text-secondary)] hover:text-[var(--accent)]"
          >
            Forgot password?
          </Link>
        </div>

        <AuthError message={error} />
        <AuthSuccess message={success} />

        <button type="submit" disabled={loading} className="btn-primary w-full h-11 disabled:opacity-50">
          {loading ? "Loading…" : "Sign in"}
        </button>
      </form>

      <p className="mt-6 text-center text-[13px] text-[var(--text-secondary)]">
        New to Inbound Reports?{" "}
        <Link href="/signup" className="font-semibold text-[var(--text-primary)] hover:text-[var(--accent)]">
          Create account
        </Link>
      </p>
    </AuthShell>
  )
}
