"use client"

import { useState, useEffect, useRef } from "react"
import { Camera, Check, AlertCircle } from "lucide-react"
import { supabase } from "@/lib/auth"
import { useI18n } from "@/lib/i18n/LocaleProvider"
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import type { User } from "@supabase/supabase-js"

interface ProfileTabProps {
  user: User
}

export function ProfileTab({ user }: ProfileTabProps) {
  const { t } = useI18n()
  const [handle, setHandle] = useState("")
  const [byline, setByline] = useState("")
  const [bio, setBio] = useState("")
  const [avatarUrl, setAvatarUrl] = useState("")
  const [uploading, setUploading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState("")
  const savedTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    let mounted = true
    async function load() {
      const { data } = await supabase
        .from("profiles")
        .select("handle, byline, bio, avatar_url")
        .eq("id", user.id)
        .maybeSingle()
      if (!mounted || !data) return
      if (data.handle) setHandle(data.handle)
      if (data.byline) setByline(data.byline)
      if (data.bio) setBio(data.bio)
      if (data.avatar_url) setAvatarUrl(data.avatar_url)
    }
    load()
    return () => { mounted = false }
  }, [user.id])

  useEffect(() => {
    return () => { if (savedTimer.current) clearTimeout(savedTimer.current) }
  }, [])

  function flashSaved() {
    setSaved(true)
    if (savedTimer.current) clearTimeout(savedTimer.current)
    savedTimer.current = setTimeout(() => setSaved(false), 3000)
  }

  async function handleAvatarUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    setError("")
    try {
      const ext = file.name.split(".").pop() || "png"
      const path = `${user.id}/avatar.${ext}`
      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(path, file, { upsert: true })
      if (uploadError) throw uploadError
      const { data: urlData } = supabase.storage.from("avatars").getPublicUrl(path)
      setAvatarUrl(urlData.publicUrl)
      flashSaved()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed")
    } finally {
      setUploading(false)
    }
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setError("")
    setSaved(false)
    setSaving(true)
    try {
      const cleanHandle = handle.replace(/^@/, "").trim()
      if (cleanHandle && cleanHandle.length < 3) {
        setError("Handle must be at least 3 characters.")
        setSaving(false)
        return
      }
      if (bio.length > 300) {
        setError("Bio must be 300 characters or fewer.")
        setSaving(false)
        return
      }
      const { error: saveError } = await supabase
        .from("profiles")
        .upsert({
          id: user.id,
          handle: cleanHandle || null,
          byline: byline.trim() || null,
          bio: bio.trim() || null,
          avatar_url: avatarUrl || null,
          display_name: byline.trim() || handle.trim() || user.email?.split("@")[0] || "Reader",
        }, { onConflict: "id" })
      if (saveError) {
        if (saveError.message.includes("profiles_handle_key")) {
          setError("This handle is already taken.")
        } else {
          setError(saveError.message)
        }
        setSaving(false)
        return
      }
      flashSaved()
    } catch {
      setError("Something went wrong.")
    } finally {
      setSaving(false)
    }
  }

  const initial = (byline || handle || user.email?.split("@")[0] || "R").charAt(0).toUpperCase()

  return (
    <form onSubmit={handleSave} className="max-w-[580px] space-y-6">
      {/* Avatar & Preview */}
      <Card>
        <CardHeader>
          <CardTitle>{t("account.profile.avatar")}</CardTitle>
          <CardDescription>{t("account.profile.avatarHint")}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-5">
            <Avatar className="h-20 w-20">
              <AvatarImage src={avatarUrl} alt={byline || handle} />
              <AvatarFallback className="text-[24px]">{initial}</AvatarFallback>
            </Avatar>
            <div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleAvatarUpload}
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="inline-flex items-center gap-2 h-10 px-4 rounded-xl border border-[var(--border)] text-[14px] font-medium text-[var(--text-primary)] hover:bg-[var(--surface-alt)] transition-colors disabled:opacity-50"
              >
                <Camera className="h-4 w-4" />
                {uploading ? "Uploading…" : t("account.profile.avatarUpload")}
              </button>
              <p className="text-[12px] text-[var(--text-secondary)] mt-1.5">
                {user.email}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Handle & Byline */}
      <Card>
        <CardHeader>
          <CardTitle>{t("account.profile.displayName")}</CardTitle>
          <CardDescription>{t("account.profile.bylineHint")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="handle">{t("account.profile.handle")}</Label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[15px] text-[var(--text-secondary)]">@</span>
              <Input
                id="handle"
                value={handle.replace(/^@/, "")}
                onChange={(e) => setHandle(e.target.value.replace(/[^a-zA-Z0-9_]/g, ""))}
                placeholder={t("account.profile.handlePlaceholder").replace("@", "")}
                className="pl-8"
                maxLength={30}
              />
            </div>
            <p className="text-[12px] text-[var(--text-secondary)]">{t("account.profile.handleHint")}</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="byline">{t("account.profile.byline")}</Label>
            <Input
              id="byline"
              value={byline}
              onChange={(e) => setByline(e.target.value)}
              placeholder={t("account.profile.bylinePlaceholder")}
              maxLength={80}
            />
          </div>
        </CardContent>
      </Card>

      {/* Bio */}
      <Card>
        <CardHeader>
          <CardTitle>{t("account.profile.bio")}</CardTitle>
          <CardDescription>{t("account.profile.bioHint")}</CardDescription>
        </CardHeader>
        <CardContent>
          <textarea
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            placeholder={t("account.profile.bioPlaceholder")}
            maxLength={300}
            rows={4}
            className="w-full rounded-xl border border-[var(--border)] bg-[var(--bg)] px-4 py-3 text-[15px] text-[var(--text-primary)] placeholder:text-[var(--text-secondary)] focus:outline-none focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent)]/10 transition-colors resize-none"
          />
          <p className="text-[12px] text-[var(--text-secondary)] mt-1.5 text-right">
            {t("account.profile.bioCharCount").replace("{count}", String(bio.length))}
          </p>
        </CardContent>
      </Card>

      {/* Feedback & Submit */}
      {(error || saved) && (
        <div className="space-y-2">
          {error && (
            <div className="flex items-center gap-2 p-3 rounded-xl bg-[var(--red-subtle-bg)] text-[13px] text-[var(--accent)]">
              <AlertCircle className="w-4 h-4 shrink-0" />
              {error}
            </div>
          )}
          {saved && (
            <div className="flex items-center gap-2 p-3 rounded-xl bg-emerald-50 text-[13px] text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400">
              <Check className="w-4 h-4 shrink-0" />
              {t("account.profile.saved")}
            </div>
          )}
        </div>
      )}

      <button
        type="submit"
        disabled={saving}
        className="h-11 px-6 rounded-xl bg-[var(--accent)] text-[var(--accent-contrast)] text-[14px] font-semibold hover:bg-[var(--accent-hover)] active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
      >
        {saving ? t("account.profile.saving") : t("account.profile.saveChanges")}
      </button>
    </form>
  )
}
