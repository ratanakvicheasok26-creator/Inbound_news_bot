"use client"

import { useState, useEffect } from "react"
import { Check, AlertCircle, Shield, Trash2, Info } from "lucide-react"
import { supabase } from "@/lib/auth"
import { useI18n } from "@/lib/i18n/LocaleProvider"
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import type { User } from "@supabase/supabase-js"

interface SecurityTabProps {
  user: User
  onSignOut: () => void
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
  const [sessions, setSessions] = useState<{ id: string; created_at: string; current: boolean }[]>([])

  useEffect(() => {
    // Current session info
    supabase.auth.getSession().then(({ data }) => {
      const s = data.session
      if (s) {
        setSessions([{
          id: s.user.id,
          created_at: s.user.created_at || new Date().toISOString(),
          current: true,
        }])
      }
    })
  }, [])

  async function handlePasswordChange(e: React.FormEvent) {
    e.preventDefault()
    setPasswordError("")
    setPasswordSaved(false)

    if (newPassword.length < 6) {
      setPasswordError(t("account.security.passwordTooShort"))
      return
    }
    if (newPassword !== confirmPassword) {
      setPasswordError(t("account.security.passwordMismatch"))
      return
    }

    setChangingPassword(true)
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword })
      if (error) {
        setPasswordError(error.message)
      } else {
        setPasswordSaved(true)
        setCurrentPassword("")
        setNewPassword("")
        setConfirmPassword("")
      }
    } catch {
      setPasswordError("Something went wrong.")
    } finally {
      setChangingPassword(false)
    }
  }

  async function handleDeleteAccount() {
    if (deleteConfirm !== "DELETE") return
    setDeleting(true)
    try {
      // Delete profile first (RLS requires auth)
      await supabase.from("profiles").delete().eq("id", user.id)
      // Sign out after deletion
      await supabase.auth.signOut()
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
        </CardHeader>
        <CardContent>
          <form onSubmit={handlePasswordChange} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="newPassword">{t("account.security.newPassword")}</Label>
              <Input
                id="newPassword"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="••••••••"
                minLength={6}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">{t("account.security.confirmPassword")}</Label>
              <Input
                id="confirmPassword"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="••••••••"
                minLength={6}
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
              <span>{t("account.security.reauthNote")}</span>
            </div>

            <button
              type="submit"
              disabled={changingPassword || !newPassword || !confirmPassword}
              className="h-10 px-5 rounded-xl bg-[var(--accent)] text-[var(--accent-contrast)] text-[13px] font-semibold hover:bg-[var(--accent-hover)] active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
            >
              {changingPassword ? "Updating…" : t("account.security.updatePassword")}
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
            {deleting ? "Deleting…" : t("account.security.deleteButton")}
          </button>
        </CardContent>
      </Card>
    </div>
  )
}
