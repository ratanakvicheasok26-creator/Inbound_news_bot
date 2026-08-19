"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { updatePassword, signOut } from "@/lib/auth"
import { useI18n } from "@/lib/i18n/LocaleProvider"
import {
  AuthShell,
  AuthError,
  AuthSuccess,
  PasswordInput,
} from "@/components/auth/AuthShell"
import zxcvbn from "zxcvbn"

function ScoreBar({ score }: { score: number }) {
  const colors = ["bg-red-500", "bg-orange-500", "bg-yellow-500", "bg-green-500", "bg-emerald-500"]
  const labels = ["Very weak", "Weak", "Fair", "Strong", "Very strong"]
  return (
    <div className="mt-2">
      <div className="flex gap-1 mb-1">
        {[0, 1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className={`h-1 flex-1 rounded-full transition-colors ${
              i <= score ? colors[score] : "bg-[var(--border)]"
            }`}
          />
        ))}
      </div>
      <p className="text-[11px] text-[var(--text-secondary)]">
        {score >= 0 && labels[score]}
      </p>
    </div>
  )
}

export default function ResetPasswordPage() {
  const { t } = useI18n()
  const router = useRouter()
  const [ready, setReady] = useState(false)
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")
  const [passwordScore, setPasswordScore] = useState(-1)

  useEffect(() => {
    // With Supabase Auth, the user arrives at this page after the callback
    // has established a session. We can check if the user is authenticated.
    // If they are, they came from a recovery link and can reset their password.
    async function checkSession() {
      const { getCurrentUser } = await import("@/lib/auth")
      const user = await getCurrentUser()
      setReady(!!user)
    }
    checkSession()
  }, [])

  function handlePasswordChange(val: string) {
    setPassword(val)
    if (val.length > 0) {
      setPasswordScore(zxcvbn(val).score)
    } else {
      setPasswordScore(-1)
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError("")
    setSuccess("")

    if (password.length < 15) {
      setError("Password must be at least 15 characters")
      return
    }
    const strength = zxcvbn(password)
    if (strength.score < 3) {
      setError("Password is too weak. Try adding more words or avoiding common patterns")
      return
    }
    if (password !== confirmPassword) {
      setError(t("auth.errorPasswordsMatch"))
      return
    }

    setLoading(true)
    try {
      const { error: authError } = await updatePassword(password)
      if (authError) {
        setError(authError.error)
        return
      }
      setSuccess(t("auth.passwordUpdated"))
      setTimeout(() => router.push("/account"), 1200)
    } catch {
      setError(t("auth.errorGeneric"))
    } finally {
      setLoading(false)
    }
  }

  if (!ready) {
    return (
      <AuthShell
        title={t("auth.resetPageTitle")}
        subtitle={t("auth.resetPageSubtitle")}
        footer={
          <Link href="/forgot-password" className="font-semibold text-[var(--text-primary)] hover:text-[var(--accent)]">
            {t("auth.requestNewLink")}
          </Link>
        }
      >
        <AuthError message={error || t("auth.resetInvalid")} />
      </AuthShell>
    )
  }

  return (
    <AuthShell title={t("auth.resetPageTitle")} subtitle={t("auth.resetPageSubtitle")}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="text-[13px] font-medium text-[var(--text-secondary)] block mb-1.5">{t("auth.newPassword")}</label>
          <PasswordInput
            required
            autoComplete="new-password"
            minLength={15}
            value={password}
            onChange={(e) => handlePasswordChange(e.target.value)}
            placeholder="At least 15 characters"
          />
          {passwordScore >= 0 && <ScoreBar score={passwordScore} />}
        </div>

        <div>
          <label className="text-[13px] font-medium text-[var(--text-secondary)] block mb-1.5">{t("auth.confirmNewPassword")}</label>
          <PasswordInput
            required
            autoComplete="new-password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder={t("auth.confirmNewPlaceholder")}
          />
        </div>

        <AuthError message={error} />
        <AuthSuccess message={success} />

        <button type="submit" disabled={loading} className="btn-primary w-full h-11 disabled:opacity-50">
          {loading ? t("auth.updating") : t("auth.updatePassword")}
        </button>
      </form>
    </AuthShell>
  )
}
