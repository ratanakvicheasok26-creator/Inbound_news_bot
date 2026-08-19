"use client"

import { useState } from "react"
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

  function validate(): string {
    const name = displayName.trim()
    if (!name) return t("auth.errorNameEmpty")
    if (name.length > 40) return t("auth.errorDisplayName")
    const mail = email.trim()
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(mail)) return t("auth.errorEmailInvalid")
    if (password.length < 8) return t("auth.errorPasswordMin")
    if (!/[A-Z]/.test(password) || !/[a-z]/.test(password) || !/[0-9]/.test(password) || !/[^A-Za-z0-9]/.test(password)) {
      return t("auth.errorPasswordWeak")
    }
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
        setError(authError.message)
        return
      }

      if (data.session) {
        router.push("/account?welcome=1")
        router.refresh()
        return
      }

      if (data.user && (!data.user.identities || data.user.identities.length === 0)) {
        setError(t("auth.errorEmailTaken"))
        return
      }

      // Try automatic sign-in if confirm email is disabled in Supabase
      const { data: signInData } = await signIn(mail, password)
      if (signInData?.session) {
        router.push("/account?welcome=1")
        router.refresh()
        return
      }

      // Only show check email screen if email verification is required
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
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder={t("auth.passwordHint")}
          />
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
