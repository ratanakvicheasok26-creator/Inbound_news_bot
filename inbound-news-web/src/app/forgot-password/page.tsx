"use client"

import { useState } from "react"
import Link from "next/link"
import { resetPassword } from "@/lib/auth"
import { useI18n } from "@/lib/i18n/LocaleProvider"
import {
  AuthShell,
  AuthError,
  AuthSuccess,
  authInputClass,
} from "@/components/auth/AuthShell"

export default function ForgotPasswordPage() {
  const { t } = useI18n()
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
      setError(t("auth.errorGeneric"))
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthShell
      title={t("auth.forgotPageTitle")}
      subtitle={t("auth.forgotPageSubtitle")}
      footer={
        <Link href="/login" className="font-semibold text-[var(--text-primary)] hover:text-[var(--accent)]">
          {t("auth.backToLogin")}
        </Link>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="text-[13px] font-medium text-[var(--text-secondary)] block mb-1.5">{t("auth.email")}</label>
          <input
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={authInputClass}
            placeholder={t("auth.emailPlaceholder")}
          />
        </div>

        <AuthError message={error} />
        <AuthSuccess message={sent ? t("auth.resetSent") : ""} />

        <button type="submit" disabled={loading} className="btn-primary w-full h-11 disabled:opacity-50">
          {loading ? t("auth.sending") : t("auth.sendResetLink")}
        </button>
      </form>
    </AuthShell>
  )
}
