"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { signUp } from "@/lib/auth"
import {
  AuthShell,
  AuthError,
  AuthSuccess,
  PasswordInput,
  authInputClass,
} from "@/components/auth/AuthShell"

export default function SignupPage() {
  const router = useRouter()
  const [displayName, setDisplayName] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")

  function validate(): string {
    const name = displayName.trim()
    if (!name) return "Please enter your display name."
    if (name.length > 40) return "Display name must be 40 characters or fewer."
    const mail = email.trim()
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(mail)) return "Enter a valid email address."
    if (password.length < 8) return "Password must be at least 8 characters."
    if (!/[A-Z]/.test(password) || !/[a-z]/.test(password) || !/[0-9]/.test(password) || !/[^A-Za-z0-9]/.test(password)) {
      return "Password needs upper + lower + number + special character."
    }
    if (password !== confirmPassword) return "Passwords do not match."
    return ""
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError("")
    setSuccess("")

    const validationError = validate()
    if (validationError) {
      setError(validationError)
      return
    }

    setLoading(true)
    try {
      const { data, error: authError } = await signUp(email.trim(), password, displayName.trim())
      if (authError) {
        setError(authError.message)
      } else if (data.session) {
        router.push("/account")
        router.refresh()
      } else {
        setSuccess("Account created! Check your email for a confirmation link before signing in.")
      }
    } catch {
      setError("Something went wrong. Try again.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthShell
      title="Create account"
      subtitle="Create an account so reading preferences can sync. Library and score stay on this device."
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="meta-text block mb-2">Display name</label>
          <input
            type="text"
            required
            autoComplete="name"
            maxLength={40}
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            className={authInputClass}
            placeholder="How you'd like to be addressed"
          />
        </div>

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
            autoComplete="new-password"
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Min 8 characters, upper + lower + number + special"
          />
        </div>

        <div>
          <label className="meta-text block mb-2">Confirm password</label>
          <PasswordInput
            required
            autoComplete="new-password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="Repeat your password"
          />
        </div>

        <AuthError message={error} />
        <AuthSuccess message={success} />

        <button type="submit" disabled={loading} className="btn-primary w-full h-11 disabled:opacity-50">
          {loading ? "Creating…" : "Create account"}
        </button>
      </form>

      <p className="mt-6 text-center text-[13px] text-[var(--text-secondary)]">
        Already have an account?{" "}
        <Link href="/login" className="font-semibold text-[var(--text-primary)] hover:text-[var(--accent)]">
          Sign in
        </Link>
      </p>
    </AuthShell>
  )
}
