"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { signUp, signIn } from "@/lib/auth"

export default function AuthPage() {
  const router = useRouter()
  const [mode, setMode] = useState<"sign-in" | "sign-up">("sign-in")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError("")
    setSuccess("")
    setLoading(true)

    try {
      if (mode === "sign-up") {
        if (password.length < 8) {
          setError("Password must be at least 8 characters.")
          setLoading(false)
          return
        }
        if (!/[A-Z]/.test(password) || !/[a-z]/.test(password) || !/[0-9]/.test(password) || !/[^A-Za-z0-9]/.test(password)) {
          setError("Use upper + lower + number + special character.")
          setLoading(false)
          return
        }
        const { error: authError } = await signUp(email, password)
        if (authError) setError(authError.message)
        else setSuccess("Check your email for a confirmation link.")
      } else {
        const { error: authError } = await signIn(email, password)
        if (authError) setError(authError.message)
        else {
          router.push("/account")
          router.refresh()
        }
      }
    } catch {
      setError("Something went wrong. Try again.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="container py-12 md:py-16">
      <div className="max-w-[440px] mx-auto bg-[var(--surface)] border border-[var(--border)] rounded-[var(--radius)] p-6 md:p-8">
        <h1 className="page-title mb-2">
          {mode === "sign-in" ? "Sign in" : "Create account"}
        </h1>
        <p className="text-[14px] text-[var(--text-secondary)] mb-6">
          {mode === "sign-in"
            ? "Welcome back. Track literacy progress across devices."
            : "Save stories and sync preferences."}
        </p>

        <div className="tier-toggle w-full mb-6">
          <button
            type="button"
            onClick={() => { setMode("sign-in"); setError(""); setSuccess("") }}
            className={`flex-1 ${mode === "sign-in" ? "active" : ""}`}
          >
            Sign in
          </button>
          <button
            type="button"
            onClick={() => { setMode("sign-up"); setError(""); setSuccess("") }}
            className={`flex-1 ${mode === "sign-up" ? "active" : ""}`}
          >
            Sign up
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="meta-text block mb-2">Email</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3 h-11 bg-[var(--bg)] border border-[var(--border)] rounded-[var(--radius-sm)] text-[15px] focus:outline-none focus:border-[var(--text-secondary)]"
              placeholder="you@example.com"
            />
          </div>

          <div>
            <label className="meta-text block mb-2">Password</label>
            <input
              type="password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-3 h-11 bg-[var(--bg)] border border-[var(--border)] rounded-[var(--radius-sm)] text-[15px] focus:outline-none focus:border-[var(--text-secondary)]"
              placeholder="Min 8 characters"
            />
          </div>

          {error && (
            <div className="p-3 rounded-[var(--radius-sm)] bg-[var(--red-subtle-bg)] text-[13px] text-[var(--accent)]">
              {error}
            </div>
          )}
          {success && (
            <div className="p-3 rounded-[var(--radius-sm)] bg-[var(--surface-alt)] text-[13px] text-[var(--text-primary)]">
              {success}
            </div>
          )}

          <button type="submit" disabled={loading} className="btn-primary w-full h-11 disabled:opacity-50">
            {loading ? "Loading…" : mode === "sign-in" ? "Sign in" : "Create account"}
          </button>
        </form>

        <div className="mt-6 pt-4 border-t border-[var(--border)] text-center">
          <Link href="/" className="text-[13px] text-[var(--text-secondary)] hover:text-[var(--accent)]">
            ← Back to Inbound Reports
          </Link>
        </div>
      </div>
    </div>
  )
}
