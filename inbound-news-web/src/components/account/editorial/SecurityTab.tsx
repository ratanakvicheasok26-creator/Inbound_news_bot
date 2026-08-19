"use client"

import { useState, useEffect } from "react"
import { Check, AlertCircle, Shield, Trash2, Info } from "lucide-react"
import { useI18n } from "@/lib/i18n/LocaleProvider"
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import type { AuthUser } from "@/lib/auth"
import { requestEmailChange } from "@/lib/auth"
import zxcvbn from "zxcvbn"

interface SecurityTabProps {
  user: AuthUser
  onSignOut: () => void
}

function ScoreBar({ score }: { score: number }) {
  const colors = ["bg-red-500", "bg-orange-500", "bg-yellow-500", "bg-green-500", "bg-emerald-500"]
  const labels = ["Very weak", "Weak", "Fair", "Strong", "Very strong"]
  return (
    <div className="mt-1">
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

export function SecurityTab({ user, onSignOut }: SecurityTabProps) {
  const { t } = useI18n()
  const [currentPassword, setCurrentPassword] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [changingPassword, setChangingPassword] = useState(false)
  const [passwordSaved, setPasswordSaved] = useState(false)
  const [passwordError, setPasswordError] = useState("")
  const [deleteConfirm, setDeleteConfirm] = useState("")
  const [deleting, setDeleting] = useState(false)
  const [passwordScore, setPasswordScore] = useState(-1)
  const [newEmail, setNewEmail] = useState("")
  const [emailChanging, setEmailChanging] = useState(false)
  const [emailChangeSent, setEmailChangeSent] = useState(false)
  const [emailChangeError, setEmailChangeError] = useState("")

  const sessions = [{
    id: user.id,
    created_at: user.created_at || new Date().toISOString(),
    current: true,
  }]

  function handlePasswordChange(val: string) {
    setNewPassword(val)
    if (val.length > 0) {
      setPasswordScore(zxcvbn(val).score)
    } else {
      setPasswordScore(-1)
    }
  }

  async function handlePasswordSubmit(e: React.FormEvent) {
    e.preventDefault()
    setPasswordError("")
    setPasswordSaved(false)

    if (newPassword.length < 15) {
      setPasswordError("Password must be at least 15 characters")
      return
    }
    const strength = zxcvbn(newPassword)
    if (strength.score < 3) {
      setPasswordError("Password is too weak. Try adding more words or avoiding common patterns")
      return
    }
    if (newPassword !== confirmPassword) {
      setPasswordError(t("account.security.passwordMismatch"))
      return
    }

    setChangingPassword(true)
    try {
      const res = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ current_password: currentPassword, new_password: newPassword }),
      })
      const data = await res.json()

      if (!res.ok) {
        setPasswordError(data.error || "Failed to update password")
      } else {
        setPasswordSaved(true)
        setCurrentPassword("")
        setNewPassword("")
        setConfirmPassword("")
        setPasswordScore(-1)
      }
    } catch {
      setPasswordError("Something went wrong.")
    } finally {
      setChangingPassword(false)
    }
  }

  async function handleEmailChange(e: React.FormEvent) {
    e.preventDefault()
    setEmailChangeError("")
    setEmailChangeSent(false)

    if (!newEmail.trim()) return
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newEmail)) {
      setEmailChangeError("Invalid email format")
      return
    }

    setEmailChanging(true)
    try {
      const { error } = await requestEmailChange(newEmail.trim())
      if (error) {
        setEmailChangeError(error.error)
      } else {
        setEmailChangeSent(true)
        setNewEmail("")
      }
    } catch {
      setEmailChangeError("Something went wrong.")
    } finally {
      setEmailChanging(false)
    }
  }

  async function handleDeleteAccount() {
    if (deleteConfirm !== "DELETE") return
    setDeleting(true)
    try {
      const { signOut: doSignOut } = await import("@/lib/auth")
      await doSignOut()
      window.location.href = "/"
    } catch {
      setDeleting(false)
    }
  }

  return (
    <div className="max-w-[580px] space-y-6">
      {/* Change Password */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-4 w-4" />
            {t("account.security.changePassword")}
          </CardTitle>
          <CardDescription className="text-[12px]">
            Passwords must be at least 15 characters. No special character rules.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handlePasswordSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="currentPassword">{t("account.security.currentPassword") || "Current password"}</Label>
              <Input
                id="currentPassword"
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="Current password"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="newPassword">{t("account.security.newPassword")}</Label>
              <Input
                id="newPassword"
                type="password"
                value={newPassword}
                onChange={(e) => handlePasswordChange(e.target.value)}
                placeholder="At least 15 characters"
                minLength={15}
              />
              {passwordScore >= 0 && <ScoreBar score={passwordScore} />}
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">{t("account.security.confirmPassword")}</Label>
              <Input
                id="confirmPassword"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Confirm new password"
                minLength={15}
              />
            </div>

            {(passwordError || passwordSaved) && (
              <div className="space-y-2">
                {passwordError && (
                  <div className="flex items-center gap-2 p-3 rounded-xl bg-[var(--red-subtle-bg)] text-[13px] text-[var(--accent)]">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    {passwordError}
                  </div>
                )}
                {passwordSaved && (
                  <div className="flex items-center gap-2 p-3 rounded-xl bg-emerald-50 text-[13px] text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400">
                    <Check className="w-4 h-4 shrink-0" />
                    {t("account.security.passwordUpdated")}
                  </div>
                )}
              </div>
            )}

            <div className="flex items-start gap-2 p-3 rounded-xl bg-[var(--surface-alt)] text-[12px] text-[var(--text-secondary)]">
              <Info className="w-4 h-4 shrink-0 mt-0.5" />
              <span>All active sessions will be signed out after password change.</span>
            </div>

            <button
              type="submit"
              disabled={changingPassword || !currentPassword || !newPassword || !confirmPassword}
              className="h-10 px-5 rounded-xl bg-[var(--accent)] text-[var(--accent-contrast)] text-[13px] font-semibold hover:bg-[var(--accent-hover)] active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
            >
              {changingPassword ? "Updating..." : t("account.security.updatePassword")}
            </button>
          </form>
        </CardContent>
      </Card>

      {/* Change Email */}
      <Card>
        <CardHeader>
          <CardTitle>Change Email Address</CardTitle>
          <CardDescription className="text-[12px]">
            A verification link will be sent to both your current and new email addresses.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleEmailChange} className="space-y-4">
            <div className="space-y-2">
              <Label>Current email</Label>
              <div className="flex items-center h-10 px-4 bg-[var(--surface-alt)] border border-[var(--border)] rounded-xl text-[14px] text-[var(--text-secondary)]">
                {user.email}
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="newEmail">New email address</Label>
              <Input
                id="newEmail"
                type="email"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                placeholder="new@example.com"
                required
              />
            </div>

            {emailChangeError && (
              <div className="flex items-center gap-2 p-3 rounded-xl bg-[var(--red-subtle-bg)] text-[13px] text-[var(--accent)]">
                <AlertCircle className="w-4 h-4 shrink-0" />
                {emailChangeError}
              </div>
            )}
            {emailChangeSent && (
              <div className="flex items-center gap-2 p-3 rounded-xl bg-emerald-50 text-[13px] text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400">
                <Check className="w-4 h-4 shrink-0" />
                Verification emails sent to both addresses. Check your inbox.
              </div>
            )}

            <button
              type="submit"
              disabled={emailChanging || !newEmail}
              className="h-10 px-5 rounded-xl bg-[var(--accent)] text-[var(--accent-contrast)] text-[13px] font-semibold hover:bg-[var(--accent-hover)] active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
            >
              {emailChanging ? "Sending..." : "Send Verification Emails"}
            </button>
          </form>
        </CardContent>
      </Card>

      {/* Sessions */}
      <Card>
        <CardHeader>
          <CardTitle>{t("account.security.sessions")}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {sessions.map((s) => (
              <div key={s.id} className="flex items-center justify-between py-2">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-[14px] font-medium text-[var(--text-primary)]">
                      {t("account.security.currentSession")}
                    </span>
                    <Badge variant="default">Active</Badge>
                  </div>
                  <p className="text-[12px] text-[var(--text-secondary)] mt-0.5">
                    {user.email}
                  </p>
                </div>
                <p className="text-[12px] text-[var(--text-secondary)]">
                  {t("account.security.lastActive")}: {new Date(s.created_at).toLocaleDateString()}
                </p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Danger Zone */}
      <Card className="border-[var(--accent)]/30">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-[var(--accent)]">
            <Trash2 className="h-4 w-4" />
            {t("account.security.dangerZone")}
          </CardTitle>
          <CardDescription>{t("account.security.deleteAccountHint")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-2">
            <Label htmlFor="deleteConfirm">{t("account.security.deleteConfirm")}</Label>
            <Input
              id="deleteConfirm"
              value={deleteConfirm}
              onChange={(e) => setDeleteConfirm(e.target.value)}
              placeholder="DELETE"
              className="max-w-[200px]"
            />
          </div>
          <button
            type="button"
            onClick={handleDeleteAccount}
            disabled={deleteConfirm !== "DELETE" || deleting}
            className="h-10 px-5 rounded-xl bg-[var(--accent)] text-[var(--accent-contrast)] text-[13px] font-semibold hover:bg-[var(--accent-hover)] active:scale-[0.98] transition-all disabled:opacity-30 disabled:cursor-not-allowed shadow-sm"
          >
            {deleting ? "Deleting..." : t("account.security.deleteButton")}
          </button>
        </CardContent>
      </Card>
    </div>
  )
}
