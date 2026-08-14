"use client"

import { useState } from "react"
import Link from "next/link"
import { resetPassword } from "@/lib/auth"
import {
  AuthShell,
  AuthError,
  AuthSuccess,
  authInputClass,
} from "@/components/auth/AuthShell"

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [sent, setSent] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError("")
    setSent(false)
    setLoading(true)

    try {
      const { error: authError } = await resetPassword(email.trim())
      if (authError) {
        setError(authError.message)
      } else {
        setSent(true)
      }
    } catch {
      setError("Something went wrong. Try again.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthShell
      title="Forgot password"
      subtitle="Enter your account email and we'll send you a link to create a new password."
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

        <AuthError message={error} />
        <AuthSuccess
          message={
            sent
              ? "If that email has an account, a password reset link is on its way."
              : ""
          }
        />

        <button type="submit" disabled={loading} className="btn-primary w-full h-11 disabled:opacity-50">
          {loading ? "Sending…" : "Send reset link"}
        </button>
      </form>

      <p className="mt-6 text-center text-[13px] text-[var(--text-secondary)]">
        Remembered it?{" "}
        <Link href="/login" className="font-semibold text-[var(--text-primary)] hover:text-[var(--accent)]">
          Back to sign in
        </Link>
      </p>
    </AuthShell>
  )
}
