"use client"

import { useState, useEffect } from "react"
import { supabase } from "@/lib/auth"
import { updatePreferences } from "@/lib/profile"
import { useI18n } from "@/lib/i18n/LocaleProvider"
import type { User } from "@supabase/supabase-js"

interface ProfileTabProps {
  user: User
}

const LANGS = [
  { id: "en" as const, key: "account.profile.langEn" },
  { id: "km" as const, key: "account.profile.langKm" },
]

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="py-4">
      <p className="meta-text mb-2">{label}</p>
      {children}
    </div>
  )
}

export function ProfileTab({ user }: ProfileTabProps) {
  const { t } = useI18n()
  const [displayName, setDisplayName] = useState(
    (user.user_metadata?.display_name as string | undefined) ||
      user.email?.split("@")[0] ||
      t("account.profile.readerFallback")
  )
  const [lang, setLang] = useState<"en" | "km">("en")
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState("")

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

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setError("")
    setSaved(false)
    setSaving(true)
    try {
      const name = displayName.trim()
      if (!name) {
        setError(t("account.profile.nameEmpty"))
        return
      }
      if (name.length > 40) {
        setError(t("account.profile.nameTooLong"))
        return
      }
      const { error: saveError } = await supabase
        .from("profiles")
        .upsert({ id: user.id, display_name: name, default_lang: lang }, { onConflict: "id" })
      if (saveError) {
        setError(saveError.message)
        return
      }
      updatePreferences({ defaultLang: lang })
      setDisplayName(name)
      setSaved(true)
    } catch {
      setError(t("membership.tryAgain"))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="max-w-[560px] bg-[var(--surface)] border border-[var(--border)] rounded-[var(--radius)] px-5 divide-y divide-[var(--border)]">
      <form onSubmit={handleSave}>
        <Row label={t("account.profile.displayName")}>
          <input
            type="text"
            value={displayName}
            maxLength={40}
            onChange={(e) => setDisplayName(e.target.value)}
            className="w-full px-3 h-11 bg-[var(--bg)] border border-[var(--border)] rounded-[var(--radius-sm)] text-[15px] focus:outline-none focus:border-[var(--text-secondary)]"
          />
        </Row>

        <Row label={t("account.profile.email")}>
          <span className="text-[14px] text-[var(--text-secondary)]">{user.email}</span>
        </Row>

        <Row label={t("account.profile.accountCreated")}>
          <span className="text-[14px] text-[var(--text-secondary)]">
            {user.created_at
              ? new Date(user.created_at).toLocaleDateString(undefined, {
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                })
              : "—"}
          </span>
        </Row>

        <Row label={t("account.profile.preferredLanguage")}>
          <div className="tier-toggle max-w-xs">
            {LANGS.map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => setLang(opt.id)}
                className={lang === opt.id ? "active" : ""}
              >
                {t(opt.key)}
              </button>
            ))}
          </div>
        </Row>

        {error && (
          <div className="p-3 rounded-[var(--radius-sm)] bg-[var(--red-subtle-bg)] text-[13px] text-[var(--accent)]">
            {error}
          </div>
        )}
        {saved && (
          <div className="p-3 rounded-[var(--radius-sm)] bg-[var(--surface-alt)] text-[13px] text-[var(--text-primary)]">
            {t("account.profile.saved")}
          </div>
        )}

        <div className="py-4">
          <button type="submit" disabled={saving} className="btn-primary h-10 px-5 text-[13px] disabled:opacity-50">
            {saving ? t("account.profile.saving") : t("account.profile.saveChanges")}
          </button>
        </div>
      </form>
    </div>
  )
}
