"use client"

import { useState } from "react"
import Link from "next/link"
import { Mail, Loader2 } from "lucide-react"
import { resetPassword } from "@/lib/auth"
import { useI18n } from "@/lib/i18n/LocaleProvider"
import {
  AuthShell,
  AuthError,
  authInputClass,
} from "@/components/auth/AuthShell"

export default function ForgotPasswordPage() {
  const { t } = useI18n()
  const [email, setEmail] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [sent, setSent] = useState(false)
  const [sentEmail, setSentEmail] = useState("")

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError("")
    setLoading(true)

    const mail = email.trim()
    try {
      const { error: authError } = await resetPassword(mail)
      if (authError) {
        setError(authError.error)
      } else {
        setSentEmail(mail)
        setSent(true)
      }
    } catch {
      setError(t("auth.errorGeneric"))
    } finally {
      setLoading(false)
    }
  }

  function handleTryAgain() {
    setSent(false)
    setError("")
  }

  if (sent) {
    return (
      <AuthShell
        title={t("auth.forgotPageTitle")}
        subtitle={t("auth.resetSent")}
        footer={
          <Link href="/login" className="font-semibold text-[var(--text-primary)] hover:text-[var(--accent)]">
            {t("auth.backToLogin")}
          </Link>
        }
      >
        <div className="text-center py-2">
          <div className="mx-auto mb-4 w-14 h-14 rounded-full flex items-center justify-center bg-[var(--red-subtle-bg)] animate-mail-float">
            <Mail className="h-7 w-7 text-[var(--accent)]" />
          </div>
          <p className="text-[14px] text-[var(--text-primary)] font-medium mb-1 animate-card-in">
            {t("auth.resetSentTo")}{" "}
            <span className="font-semibold">{sentEmail}</span>
          </p>
          <p className="text-[13px] text-[var(--text-secondary)] mb-6 animate-card-in-delayed">
            {t("auth.resetCheckSpam")}
          </p>
          <button
            type="button"
            onClick={handleTryAgain}
            className="text-[13px] font-semibold text-[var(--accent)] hover:underline"
          >
            {t("auth.tryAgainReset")}
          </button>
        </div>
      </AuthShell>
    )
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

        <button type="submit" disabled={loading} className="btn-primary w-full h-11 disabled:opacity-50 inline-flex items-center justify-center gap-2">
          {loading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              {t("auth.sending")}
            </>
          ) : (
            t("auth.sendResetLink")
          )}
        </button>
      </form>
    </AuthShell>
  )
}
