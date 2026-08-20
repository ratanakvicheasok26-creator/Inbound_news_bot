"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Loader2 } from "lucide-react"
import { signIn, resendVerification } from "@/lib/auth"
import { useI18n } from "@/lib/i18n/LocaleProvider"
import {
  AuthShell,
  AuthError,
  AuthSuccess,
  PasswordInput,
  authInputClass,
} from "@/components/auth/AuthShell"

const EMAIL_NOT_CONFIRMED = "Please confirm your email before signing in. Check your inbox."

export default function LoginPage() {
  const { t } = useI18n()
  const router = useRouter()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [loading, setLoading] = useState(false)
  const [resending, setResending] = useState(false)
  const [error, setError] = useState("")
  const [resendSuccess, setResendSuccess] = useState("")

  const showResendVerification = error.includes("confirm your email") || error === EMAIL_NOT_CONFIRMED

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError("")
    setResendSuccess("")
    setLoading(true)
    try {
      const mail = email.trim()
      const { error: authError } = await signIn(mail, password)
      if (authError) {
        setError(authError.error)
      } else {
        const params = new URLSearchParams(window.location.search)
        router.push(params.get("returnTo") || "/account")
        router.refresh()
      }
    } catch {
      setError(t("auth.errorGeneric"))
    } finally {
      setLoading(false)
    }
  }

  async function handleResendVerification() {
    const mail = email.trim()
    if (!mail) return
    setResending(true)
    setResendSuccess("")
    try {
      const { error: resendError } = await resendVerification(mail)
      if (resendError) {
        setError(resendError.error)
      } else {
        setResendSuccess(t("auth.resendVerificationSent"))
      }
    } catch {
      setError(t("auth.errorGeneric"))
    } finally {
      setResending(false)
    }
  }

  return (
    <AuthShell
      title={t("auth.signInButton")}
      subtitle={t("auth.loginSubtitle")}
      footer={
        <span>
          {t("auth.noAccount")}{" "}
          <Link href="/signup" className="font-semibold text-[var(--text-primary)] hover:text-[var(--accent)]">
            {t("auth.signUpButton")}
          </Link>
        </span>
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

        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-[13px] font-medium text-[var(--text-secondary)]">{t("auth.password")}</label>
            <Link
              href="/forgot-password"
              className="text-[13px] text-[var(--text-secondary)] hover:text-[var(--accent)]"
            >
              {t("auth.forgotPassword")}
            </Link>
          </div>
          <PasswordInput
            required
            autoComplete="current-password"
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder={t("auth.passwordHint")}
          />
        </div>

        <AuthError message={error} />
        <AuthSuccess message={resendSuccess} />

        {showResendVerification && (
          <button
            type="button"
            onClick={handleResendVerification}
            disabled={resending || !email.trim()}
            className="w-full h-10 text-[13px] font-semibold text-[var(--accent)] border border-[var(--border)] rounded-[var(--radius-sm)] hover:bg-[var(--surface-alt)] disabled:opacity-50 inline-flex items-center justify-center gap-2"
          >
            {resending ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                {t("auth.resendVerificationSending")}
              </>
            ) : (
              t("auth.resendVerification")
            )}
          </button>
        )}

        <button type="submit" disabled={loading} className="btn-primary w-full h-11 disabled:opacity-50 inline-flex items-center justify-center gap-2">
          {loading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              {t("auth.signingIn")}
            </>
          ) : (
            t("auth.signInButton")
          )}
        </button>
      </form>
    </AuthShell>
  )
}
