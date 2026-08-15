"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { signUp } from "@/lib/auth"
import { useI18n } from "@/lib/i18n/LocaleProvider"
import {
  AuthShell,
  AuthError,
  AuthSuccess,
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
  const [success, setSuccess] = useState("")

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
        setSuccess(t("auth.accountCreated"))
      }
    } catch {
      setError(t("auth.errorGeneric"))
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthShell title={t("auth.signUpButton")} subtitle={t("auth.signupSubtitleSync")}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="meta-text block mb-2">{t("auth.displayName")}</label>
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
          <label className="meta-text block mb-2">{t("auth.email")}</label>
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
          <label className="meta-text block mb-2">{t("auth.password")}</label>
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
          <label className="meta-text block mb-2">{t("auth.confirmPasswordLabel")}</label>
          <PasswordInput
            required
            autoComplete="new-password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder={t("auth.confirmPassword")}
          />
        </div>

        <AuthError message={error} />
        <AuthSuccess message={success} />

        <button type="submit" disabled={loading} className="btn-primary w-full h-11 disabled:opacity-50">
          {loading ? t("auth.creating") : t("auth.signUpButton")}
        </button>
      </form>

      <p className="mt-6 text-center text-[13px] text-[var(--text-secondary)]">
        {t("auth.haveAccount")}{" "}
        <Link href="/login" className="font-semibold text-[var(--text-primary)] hover:text-[var(--accent)]">
          {t("auth.signInButton")}
        </Link>
      </p>
    </AuthShell>
  )
}
