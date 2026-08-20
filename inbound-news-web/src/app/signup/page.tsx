"use client"

import { useState, useCallback, useEffect } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Loader2, KeyRound } from "lucide-react"
import { signUp, verifyOtp, resendOtp } from "@/lib/auth"
import { useI18n } from "@/lib/i18n/LocaleProvider"
import {
  AuthShell,
  AuthError,
  AuthSuccess,
  PasswordInput,
  authInputClass,
} from "@/components/auth/AuthShell"
import { OtpInput } from "@/components/auth/OtpInput"
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

export default function SignupPage() {
  const { t } = useI18n()
  const router = useRouter()
  const [displayName, setDisplayName] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [passwordScore, setPasswordScore] = useState(-1)

  // Verification state
  const [isVerifying, setIsVerifying] = useState(false)
  const [sentEmail, setSentEmail] = useState("")
  const [otp, setOtp] = useState<string[]>(Array(6).fill(""))
  const [verifying, setVerifying] = useState(false)
  const [verifyError, setVerifyError] = useState("")
  const [resending, setResending] = useState(false)
  const [resendSuccess, setResendSuccess] = useState("")
  const [resendCooldown, setResendCooldown] = useState(0)

  // Cooldown timer effect
  useEffect(() => {
    if (resendCooldown <= 0) return
    const timer = setInterval(() => {
      setResendCooldown((prev) => prev - 1)
    }, 1000)
    return () => clearInterval(timer)
  }, [resendCooldown])

  const handlePasswordChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value
    setPassword(val)
    if (val.length > 0) {
      setPasswordScore(zxcvbn(val).score)
    } else {
      setPasswordScore(-1)
    }
  }, [])

  function validate(): string {
    const name = displayName.trim()
    if (!name) return t("auth.errorNameEmpty")
    if (name.length > 40) return t("auth.errorDisplayName")
    const mail = email.trim()
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(mail)) return t("auth.errorEmailInvalid")
    if (password.length < 15) return "Password must be at least 15 characters"
    const strength = zxcvbn(password)
    if (strength.score < 3) return "Password is too weak. Try adding more words or avoiding common patterns"
    if (password !== confirmPassword) return t("auth.errorPasswordsMatch")
    return ""
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError("")

    const validationError = validate()
    if (validationError) {
      setError(validationError)
      return
    }

    setLoading(true)
    try {
      const mail = email.trim()
      const { data, error: authError } = await signUp(mail, password, displayName.trim())
      if (authError) {
        setError(authError.error)
        return
      }

      if (!data) {
        setError(t("auth.errorGeneric"))
        return
      }

      if (data.sessionCreated) {
        router.push("/account")
        return
      }

      setSentEmail(mail)
      setIsVerifying(true)
      setResendCooldown(60) // Start 60s cooldown on initial email send
    } catch {
      setError(t("auth.errorGeneric"))
    } finally {
      setLoading(false)
    }
  }

  async function handleVerify(codeToVerify?: string) {
    const code = codeToVerify || otp.join("")
    if (code.length < 6) {
      setVerifyError(t("auth.invalidCode"))
      return
    }

    setVerifyError("")
    setResendSuccess("")
    setVerifying(true)

    try {
      const { data, error: otpError } = await verifyOtp(sentEmail, code)
      if (otpError) {
        setVerifyError(otpError.error)
        return
      }

      if (data?.user) {
        // Email verified, redirect to account/dashboard page
        router.push("/account")
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

  async function handleResendCode() {
    if (resendCooldown > 0 || resending) return

    setVerifyError("")
    setResendSuccess("")
    setResending(true)

    try {
      const { error: resendErr } = await resendOtp(sentEmail)
      if (resendErr) {
        setVerifyError(resendErr.error)
      } else {
        setResendSuccess(t("auth.resendVerificationSent"))
        setResendCooldown(60) // Reset 60s cooldown
        setOtp(Array(6).fill("")) // Reset OTP inputs
      }
    } catch {
      setVerifyError(t("auth.resendFailed"))
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
          <span>
            {t("auth.haveAccount")}{" "}
            <Link href="/login" className="font-semibold text-[var(--text-primary)] hover:text-[var(--accent)]">
              {t("auth.signInButton")}
            </Link>
          </span>
        }
      >
        <div className="space-y-4">
          <div className="text-center">
            <div className="mx-auto mb-3 w-12 h-12 rounded-full flex items-center justify-center bg-[var(--red-subtle-bg)] animate-mail-float">
              <KeyRound className="h-6 w-6 text-[var(--accent)]" />
            </div>
            <p className="text-[14px] text-[var(--text-primary)] font-semibold mb-1">
              {sentEmail}
            </p>
          </div>

          <OtpInput
            value={otp}
            onChange={setOtp}
            disabled={verifying}
            onComplete={(code) => handleVerify(code)}
          />

          <AuthError message={verifyError} />
          <AuthSuccess message={resendSuccess} />

          <button
            type="button"
            onClick={() => handleVerify()}
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
            <p className="text-[13px] text-[var(--text-secondary)] mb-1">
              {t("auth.didntReceiveCode")}
            </p>
            <button
              type="button"
              onClick={handleResendCode}
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
      title={t("auth.signUpButton")}
      subtitle={t("auth.signupSubtitleSync")}
      footer={
        <span>
          {t("auth.haveAccount")}{" "}
          <Link href="/login" className="font-semibold text-[var(--text-primary)] hover:text-[var(--accent)]">
            {t("auth.signInButton")}
          </Link>
        </span>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="text-[13px] font-medium text-[var(--text-secondary)] block mb-1.5">{t("auth.displayName")}</label>
          <input
            type="text"
            required
            autoComplete="name"
            maxLength={40}
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            className={authInputClass}
            placeholder={t("auth.displayNameHint")}
          />
        </div>

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
          <label className="text-[13px] font-medium text-[var(--text-secondary)] block mb-1.5">{t("auth.password")}</label>
          <PasswordInput
            required
            autoComplete="new-password"
            minLength={15}
            value={password}
            onChange={handlePasswordChange}
            placeholder="At least 15 characters"
          />
          {passwordScore >= 0 && <ScoreBar score={passwordScore} />}
          <p className="text-[11px] text-[var(--text-secondary)] mt-1">
            Use a passphrase or mix unrelated words. No special character rules.
          </p>
        </div>

        <div>
          <label className="text-[13px] font-medium text-[var(--text-secondary)] block mb-1.5">{t("auth.confirmPasswordLabel")}</label>
          <PasswordInput
            required
            autoComplete="new-password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder={t("auth.confirmPassword")}
          />
        </div>

        <AuthError message={error} />

        <button type="submit" disabled={loading} className="btn-primary w-full h-11 disabled:opacity-50">
          {loading ? t("auth.creating") : t("auth.signUpButton")}
        </button>
      </form>
    </AuthShell>
  )
}
