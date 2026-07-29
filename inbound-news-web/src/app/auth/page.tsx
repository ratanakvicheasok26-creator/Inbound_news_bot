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
        const { error: authError } = await signUp(email, password)
        if (authError) {
          setError(authError.message)
        } else {
          setSuccess("Check your email for a confirmation link.")
        }
      } else {
        const { error: authError } = await signIn(email, password)
        if (authError) {
          setError(authError.message)
        } else {
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
    <div className="container">
      <section className="py-16 md:py-24 max-w-[480px] mx-auto">
        {/* Header */}
        <div className="pb-8 border-b-2 border-[var(--text-primary)] mb-8">
          <h1 className="page-title">
            {mode === "sign-in" ? "SIGN IN" : "SIGN UP"}
          </h1>
          <p className="mt-3 font-mono text-[11px] uppercase tracking-[0.12em] text-[var(--text-secondary)]">
            {mode === "sign-in"
              ? "Welcome back. Track your literacy progress."
              : "Create an account to save your progress."}
          </p>
        </div>

        {/* Toggle */}
        <div className="flex border-2 border-[var(--text-primary)] overflow-hidden mb-8">
          <button
            onClick={() => { setMode("sign-in"); setError(""); setSuccess("") }}
            className={`flex-1 px-4 py-2.5 font-mono text-[11px] font-bold uppercase tracking-[0.1em] transition-colors ${
              mode === "sign-in"
                ? "bg-[var(--text-primary)] text-inverted"
                : "text-[var(--text-primary)] hover:bg-[var(--text-primary)] hover:text-inverted"
            }`}
          >
            Sign In
          </button>
          <div className="w-px bg-[var(--border)]" />
          <button
            onClick={() => { setMode("sign-up"); setError(""); setSuccess("") }}
            className={`flex-1 px-4 py-2.5 font-mono text-[11px] font-bold uppercase tracking-[0.1em] transition-colors ${
              mode === "sign-up"
                ? "bg-[var(--text-primary)] text-inverted"
                : "text-[var(--text-primary)] hover:bg-[var(--text-primary)] hover:text-inverted"
            }`}
          >
            Sign Up
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="font-mono text-[10px] uppercase tracking-[0.12em] text-[var(--text-secondary)] font-bold block mb-2">
              Email
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-3 bg-transparent border-2 border-[var(--text-primary)] font-mono text-[14px] text-[var(--text-primary)] placeholder:text-[var(--text-secondary)] focus:outline-none focus:border-[var(--accent)] transition-colors"
              placeholder="you@example.com"
            />
          </div>

          <div>
            <label className="font-mono text-[10px] uppercase tracking-[0.12em] text-[var(--text-secondary)] font-bold block mb-2">
              Password
            </label>
            <input
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-3 bg-transparent border-2 border-[var(--text-primary)] font-mono text-[14px] text-[var(--text-primary)] placeholder:text-[var(--text-secondary)] focus:outline-none focus:border-[var(--accent)] transition-colors"
              placeholder="Min 6 characters"
            />
          </div>

          {error && (
            <div className="p-3 border-2 border-[var(--accent)] bg-[var(--red-subtle-bg)]">
              <p className="font-mono text-[11px] text-[var(--accent)]">{error}</p>
            </div>
          )}

          {success && (
            <div className="p-3 border-2 border-[var(--text-primary)] bg-[var(--surface-alt)]">
              <p className="font-mono text-[11px] text-[var(--text-primary)]">{success}</p>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full px-6 py-3 bg-[var(--text-primary)] text-inverted font-mono text-[12px] font-bold uppercase tracking-[0.1em] hover:bg-[var(--accent)] transition-colors disabled:opacity-50"
          >
            {loading ? "Loading..." : mode === "sign-in" ? "Sign In" : "Create Account"}
          </button>
        </form>

        {/* Footer */}
        <div className="mt-8 pt-6 border-t border-[var(--border)] text-center">
          <Link
            href="/"
            className="font-mono text-[10px] uppercase tracking-[0.12em] text-[var(--text-secondary)] hover:text-[var(--accent)] transition-colors"
          >
            &larr; Back to Inbound Reports
          </Link>
        </div>
      </section>
    </div>
  )
}
