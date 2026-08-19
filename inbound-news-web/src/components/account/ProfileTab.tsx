/* eslint-disable react-hooks/set-state-in-effect */
"use client"

import { useState, useEffect, useRef } from "react"
import { Check, AlertCircle } from "lucide-react"
import { supabase } from "@/lib/auth"
import { getProfile, saveProfile } from "@/lib/profile"
import { useI18n } from "@/lib/i18n/LocaleProvider"
import type { AuthUser } from "@/lib/auth"

interface ProfileTabProps {
  user: AuthUser
}

const LANGS = [
  { id: "en" as const, label: "English", flag: "🇬🇧" },
  { id: "km" as const, label: "ភាសាខ្មែរ", flag: "🇰🇭" },
]

export function ProfileTab({ user }: ProfileTabProps) {
  const { t, locale, setLocale } = useI18n()
  const [displayName, setDisplayName] = useState(
    (user.user_metadata?.display_name as string | undefined) ||
      user.email?.split("@")[0] ||
      t("account.profile.readerFallback")
  )
  const [lang, setLang] = useState<"en" | "km">(locale)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState("")
  const savedTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    setLang(locale)
  }, [locale])

  useEffect(() => {
    let mounted = true
    async function load() {
      const { data } = await supabase
        .from("profiles")
        .select("display_name, default_lang")
        .eq("id", user.id)
        .maybeSingle()
      if (!mounted || !data) return
      if (data.display_name) setDisplayName(data.display_name)
      if (data.default_lang === "en" || data.default_lang === "km") setLang(data.default_lang)
    }
    load()
    return () => {
      mounted = false
    }
  }, [user.id])

  useEffect(() => {
    return () => {
      if (savedTimer.current) clearTimeout(savedTimer.current)
    }
  }, [])

  function flashSaved() {
    setSaved(true)
    if (savedTimer.current) clearTimeout(savedTimer.current)
    savedTimer.current = setTimeout(() => setSaved(false), 3000)
  }

  function handleLangSwitch(next: "en" | "km") {
    setLang(next)
    setLocale(next)
    flashSaved()
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setError("")
    setSaved(false)
    setSaving(true)
    try {
      const name = displayName.trim()
      if (!name) {
        setError(t("account.profile.nameEmpty"))
        setSaving(false)
        return
      }
      if (name.length > 40) {
        setError(t("account.profile.nameTooLong"))
        setSaving(false)
        return
      }
      const profile = getProfile()
      const { error: saveError } = await supabase
        .from("profiles")
        .upsert({
          id: user.id,
          display_name: name,
          default_lang: lang,
          default_tier: profile.preferences.defaultTier,
          stealth_mode: profile.preferences.stealthMode,
          telegram_digest: profile.preferences.telegramDigest,
        }, { onConflict: "id" })
      if (saveError) {
        setError(saveError.message)
        setSaving(false)
        return
      }
      setLocale(lang)
      saveProfile({ displayName: name })
      setDisplayName(name)
      flashSaved()
    } catch {
      setError(t("membership.tryAgain"))
    } finally {
      setSaving(false)
    }
  }

  const initial = displayName.charAt(0).toUpperCase()

  return (
    <div className="max-w-[580px] space-y-5">
      {/* Profile header */}
      <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-6">
        <div className="flex items-center gap-4 mb-5">
          <div className="w-14 h-14 rounded-full bg-[var(--accent)] text-[var(--accent-contrast)] flex items-center justify-center text-[22px] font-bold shrink-0 shadow-sm">
            {initial}
          </div>
          <div className="min-w-0">
            <p className="text-[17px] font-semibold text-[var(--text-primary)] truncate">{displayName}</p>
            <p className="text-[13px] text-[var(--text-secondary)] truncate">{user.email}</p>
          </div>
        </div>
        <div className="flex items-center gap-3 text-[12px] text-[var(--text-secondary)]">
          <span className="inline-flex items-center gap-1.5 bg-[var(--surface-alt)] px-3 py-1.5 rounded-full">
            {t("account.profile.accountCreated")}:{" "}
            {user.created_at
              ? new Date(user.created_at).toLocaleDateString(undefined, {
                  year: "numeric",
                  month: "short",
                  day: "numeric",
                })
              : "—"}
          </span>
        </div>
      </div>

      {/* Edit form */}
      <form onSubmit={handleSave} className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl divide-y divide-[var(--border)]">
        {/* Display name */}
        <div className="px-6 py-5">
          <label className="block text-[13px] font-medium text-[var(--text-secondary)] mb-2">
            {t("account.profile.displayName")}
          </label>
          <input
            type="text"
            value={displayName}
            maxLength={40}
            onChange={(e) => setDisplayName(e.target.value)}
            className="w-full h-11 px-4 bg-[var(--bg)] border border-[var(--border)] rounded-xl text-[15px] text-[var(--text-primary)] placeholder:text-[var(--text-secondary)] focus:outline-none focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent)]/10 transition-colors"
          />
        </div>

        {/* Email (read-only) */}
        <div className="px-6 py-5">
          <label className="block text-[13px] font-medium text-[var(--text-secondary)] mb-2">
            {t("account.profile.email")}
          </label>
          <div className="flex items-center gap-2 h-11 px-4 bg-[var(--surface-alt)] border border-[var(--border)] rounded-xl text-[15px] text-[var(--text-secondary)]">
            {user.email}
          </div>
        </div>

        {/* Preferred language */}
        <div className="px-6 py-5">
          <label className="block text-[13px] font-medium text-[var(--text-secondary)] mb-3">
            {t("account.profile.preferredLanguage")}
          </label>
          <div className="grid grid-cols-2 gap-2">
            {LANGS.map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => handleLangSwitch(opt.id)}
                className={`flex items-center justify-center gap-2 h-11 rounded-xl text-[14px] font-medium border transition-all ${
                  lang === opt.id
                    ? "bg-[var(--accent)] text-[var(--accent-contrast)] border-[var(--accent)] shadow-sm"
                    : "bg-[var(--bg)] text-[var(--text-secondary)] border-[var(--border)] hover:border-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                }`}
              >
                <span className="text-[16px]">{opt.flag}</span>
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Feedback */}
        {(error || saved) && (
          <div className="px-6 py-3">
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

        {/* Submit */}
        <div className="px-6 py-4">
          <button
            type="submit"
            disabled={saving}
            className="h-11 px-6 rounded-xl bg-[var(--accent)] text-[var(--accent-contrast)] text-[14px] font-semibold hover:bg-[var(--accent-hover)] active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
          >
            {saving ? t("account.profile.saving") : t("account.profile.saveChanges")}
          </button>
        </div>
      </form>
    </div>
  )
}
