"use client"

import { useState, useCallback } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Mail } from "lucide-react"
import { signUp, signIn } from "@/lib/auth"
import { useI18n } from "@/lib/i18n/LocaleProvider"
import {
  AuthShell,
  AuthError,
  PasswordInput,
  authInputClass,
} from "@/components/auth/AuthShell"
import zxcvbn from "zxcvbn"

function validatePasswordStrength(password: string): { valid: boolean; error: string; score: number } {
  if (password.length < 15) {
    return { valid: false, error: "Password must be at least 15 characters", score: 0 }
  }
  const result = zxcvbn(password)
  if (result.score < 3) {
    return { valid: false, error: "Password is too weak. Try adding more words or avoiding common patterns", score: result.score }
  }
  return { valid: true, error: "", score: result.score }
}

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
  const [emailSent, setEmailSent] = useState(false)
  const [sentEmail, setSentEmail] = useState("")
  const [passwordScore, setPasswordScore] = useState(-1)

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

      if (data) {
        router.push("/account?welcome=1")
        router.refresh()
        return
      }

      setSentEmail(mail)
      setEmailSent(true)
    } catch {
      setError(t("auth.errorGeneric"))
    } finally {
      setLoading(false)
    }
  }

  if (emailSent) {
    return (
      <AuthShell
        title={t("auth.checkEmailTitle")}
        subtitle={t("auth.checkEmailSubtitle")}
        footer={
          <Link href="/login" className="font-semibold text-[var(--text-primary)] hover:text-[var(--accent)]">
            {t("auth.goToSignIn")}
          </Link>
        }
      >
        <div className="text-center py-4">
          <div className="mx-auto mb-4 w-14 h-14 rounded-full flex items-center justify-center bg-[var(--red-subtle-bg)] animate-mail-float">
            <Mail className="h-7 w-7 text-[var(--accent)]" />
          </div>
          <p className="text-[14px] text-[var(--text-primary)] font-medium mb-1 animate-card-in">
            {t("auth.checkEmailSentTo")}{" "}
            <span className="font-semibold">{sentEmail}</span>
          </p>
          <p className="text-[13px] text-[var(--text-secondary)] animate-card-in-delayed">
            {t("auth.checkEmailInstructions")}
          </p>
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
