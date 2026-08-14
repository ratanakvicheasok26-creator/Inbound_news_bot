"use client"

import { useState, useEffect } from "react"
import { supabase } from "@/lib/auth"
import { updatePreferences } from "@/lib/profile"
import type { User } from "@supabase/supabase-js"

interface ProfileTabProps {
  user: User
}

const LANGS = [
  { id: "en" as const, label: "English" },
  { id: "km" as const, label: "Khmer" },
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
  const [displayName, setDisplayName] = useState(
    (user.user_metadata?.display_name as string | undefined) ||
      user.email?.split("@")[0] ||
      "Reader"
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
        setError("Display name can't be empty.")
        return
      }
      if (name.length > 40) {
        setError("Display name must be 40 characters or fewer.")
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
      setError("Something went wrong. Try again.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="max-w-[560px] bg-[var(--surface)] border border-[var(--border)] rounded-[var(--radius)] px-5 divide-y divide-[var(--border)]">
      <form onSubmit={handleSave}>
        <Row label="Display name">
          <input
            type="text"
            value={displayName}
            maxLength={40}
            onChange={(e) => setDisplayName(e.target.value)}
            className="w-full px-3 h-11 bg-[var(--bg)] border border-[var(--border)] rounded-[var(--radius-sm)] text-[15px] focus:outline-none focus:border-[var(--text-secondary)]"
          />
        </Row>

        <Row label="Email">
          <span className="text-[14px] text-[var(--text-secondary)]">{user.email}</span>
        </Row>

        <Row label="Account created">
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

        <Row label="Preferred language">
          <div className="tier-toggle max-w-xs">
            {LANGS.map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => setLang(opt.id)}
                className={lang === opt.id ? "active" : ""}
              >
                {opt.label}
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
            Saved.
          </div>
        )}

        <div className="py-4">
          <button type="submit" disabled={saving} className="btn-primary h-10 px-5 text-[13px] disabled:opacity-50">
            {saving ? "Saving…" : "Save changes"}
          </button>
        </div>
      </form>
    </div>
  )
}
