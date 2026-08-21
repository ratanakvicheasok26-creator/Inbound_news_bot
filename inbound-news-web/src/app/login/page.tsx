"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Loader2, KeyRound } from "lucide-react"
import { signIn, verifyOtp, resendOtp } from "@/lib/auth"
import { useI18n } from "@/lib/i18n/LocaleProvider"
import {
  AuthShell,
  AuthError,
  AuthSuccess,
  PasswordInput,
  authInputClass,
} from "@/components/auth/AuthShell"
import { OtpInput } from "@/components/auth/OtpInput"

const EMAIL_NOT_CONFIRMED = "Please confirm your email before signing in. Check your inbox."

export default function LoginPage() {
  const { t } = useI18n()
  const router = useRouter()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [resendSuccess, setResendSuccess] = useState("")

  // OTP Verification state for unconfirmed users attempting login
  const [isVerifying, setIsVerifying] = useState(false)
  const [otp, setOtp] = useState<string[]>(Array(8).fill(""))
  const [verifying, setVerifying] = useState(false)
  const [verifyError, setVerifyError] = useState("")
  const [resending, setResending] = useState(false)
  const [resendCooldown, setResendCooldown] = useState(0)

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

  async function handleVerifyOtp(codeToVerify?: string) {
    const code = codeToVerify || otp.join("")
    if (code.length < 6) {
      setVerifyError(t("auth.invalidCode"))
      return
    }

    setVerifyError("")
    setResendSuccess("")
    setVerifying(true)

    try {
      const mail = email.trim()
      const { data, error: otpError } = await verifyOtp(mail, code, password)
      if (otpError) {
        setVerifyError(otpError.error)
        return
      }

      if (data?.sessionCreated) {
        const params = new URLSearchParams(window.location.search)
        router.push(params.get("returnTo") || "/account")
        router.refresh()
      } else if (data?.user && password) {
        const { error: signInErr } = await signIn(mail, password)
        if (signInErr) {
          setVerifyError(signInErr.error)
          return
        }
        const params = new URLSearchParams(window.location.search)
        router.push(params.get("returnTo") || "/account")
        router.refresh()
      } else {
        setVerifyError(t("auth.errorGeneric"))
      }
    } catch {
      setVerifyError(t("auth.errorGeneric"))
    } finally {
      setVerifying(false)
    }
  }

  async function handleResendVerification() {
    const mail = email.trim()
    if (!mail || resending) return

    setResending(true)
    setResendSuccess("")
    setVerifyError("")

    try {
      const { error: resendError } = await resendOtp(mail)
      if (resendError) {
        setError(resendError.error)
      } else {
        setResendSuccess(t("auth.resendVerificationSent"))
        setIsVerifying(true)
        setResendCooldown(60)
      }
    } catch {
      setError(t("auth.errorGeneric"))
    } finally {
      setResending(false)
    }
  }

  if (isVerifying) {
    const codeComplete = otp.every((digit) => digit.length === 1)

    return (
      <AuthShell
        title={t("auth.verifyEmailTitle")}
        subtitle={t("auth.verifyEmailSubtitle")}
        footer={
          <button
            type="button"
            onClick={() => setIsVerifying(false)}
            className="font-semibold text-[var(--text-primary)] hover:text-[var(--accent)] text-[13px]"
          >
            ← {t("auth.signInButton")}
          </button>
        }
      >
        <div className="space-y-4">
          <div className="text-center">
            <div className="mx-auto mb-3 w-12 h-12 rounded-full flex items-center justify-center bg-[var(--red-subtle-bg)] animate-mail-float">
              <KeyRound className="h-6 w-6 text-[var(--accent)]" />
            </div>
            <p className="text-[14px] text-[var(--text-primary)] font-semibold mb-1">
              {email}
            </p>
          </div>

          <OtpInput
            value={otp}
            onChange={setOtp}
            disabled={verifying}
            onComplete={(code) => handleVerifyOtp(code)}
          />

          <AuthError message={verifyError} />
          <AuthSuccess message={resendSuccess} />

          <button
            type="button"
            onClick={() => handleVerifyOtp()}
            disabled={verifying || !codeComplete}
            className="btn-primary w-full h-11 disabled:opacity-50 inline-flex items-center justify-center gap-2"
          >
            {verifying ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                {t("auth.verifying")}
              </>
            ) : (
              t("auth.verifyEmailButton")
            )}
          </button>

          <div className="text-center pt-2">
            <button
              type="button"
              onClick={handleResendVerification}
              disabled={resendCooldown > 0 || resending}
              className="text-[13px] font-semibold text-[var(--accent)] hover:underline disabled:opacity-50 disabled:no-underline disabled:cursor-not-allowed inline-flex items-center gap-1.5"
            >
              {resending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              {resendCooldown > 0
                ? `${t("auth.resendCodeIn")} ${resendCooldown}s`
                : t("auth.resendCode")}
            </button>
          </div>
        </div>
      </AuthShell>
    )
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
          <div className="space-y-2">
            <button
              type="button"
              onClick={() => setIsVerifying(true)}
              className="btn-primary w-full h-10 text-[13px] inline-flex items-center justify-center gap-2"
            >
              <KeyRound className="h-4 w-4" />
              Enter 6-Digit Code
            </button>
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
          </div>
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
