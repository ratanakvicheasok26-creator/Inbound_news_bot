"use client"

import { useState } from "react"
import Link from "next/link"
import { getProfile, updatePreferences, resetProfile, syncPreferencesToSupabase } from "@/lib/profile"
import { useI18n } from "@/lib/i18n/LocaleProvider"
import type { AuthUser } from "@/lib/auth"

interface SettingsTabProps {
  user: AuthUser | null
  onSignOut: () => void
}

function Segmented<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T
  options: { id: T; label: string }[]
  onChange: (v: T) => void
}) {
  return (
    <div className="tier-toggle">
      {options.map((opt) => (
        <button
          key={opt.id}
          type="button"
          onClick={() => onChange(opt.id)}
          className={value === opt.id ? "active" : ""}
        >
          {opt.label}
        </button>
      ))}
    </div>
  )
}

function Switch({
  checked,
  onChange,
  accent = false,
}: {
  checked: boolean
  onChange: () => void
  accent?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onChange}
      className={`w-11 h-6 rounded-full relative transition-colors border border-[var(--border)] ${
        checked
          ? accent
            ? "bg-[var(--accent)] border-[var(--accent)]"
            : "bg-[var(--text-primary)] border-[var(--text-primary)]"
          : "bg-[var(--surface-alt)]"
      }`}
      role="switch"
      aria-checked={checked}
    >
      <span
        className={`absolute top-0.5 w-4 h-4 rounded-full transition-transform ${
          checked
            ? "left-5 bg-[var(--accent-contrast)]"
            : "left-0.5 bg-[var(--text-secondary)]"
        }`}
      />
    </button>
  )
}

export function SettingsTab({ user, onSignOut }: SettingsTabProps) {
  const { t } = useI18n()
  const [prefs, setPrefs] = useState(() => getProfile().preferences)

  function update<K extends keyof typeof prefs>(key: K, value: (typeof prefs)[K]) {
    const next = { ...prefs, [key]: value }
    setPrefs(next)
    updatePreferences({ [key]: value })
    if (user) {
      syncPreferencesToSupabase().catch(() => {
        console.warn("Failed to sync preferences to Supabase")
      })
    }
  }

  function handleDelete() {
    if (confirm(t("account.settings.eraseConfirm"))) {
      resetProfile()
      setPrefs({
        defaultTier: "standard",
        defaultLang: "en",
        stealthMode: false,
        telegramDigest: false,
      })
    }
  }

  return (
    <div className="max-w-[560px] bg-[var(--surface)] border border-[var(--border)] rounded-[var(--radius)] px-5 divide-y divide-[var(--border)]">
      <div className="flex items-center justify-between py-4 gap-4">
        <label className="meta-text">{t("account.settings.defaultTier")}</label>
        <Segmented
          value={prefs.defaultTier}
          options={[
            { id: "eli5", label: "ELI5" },
            { id: "standard", label: t("story.simplified") },
            { id: "deep", label: t("story.deepCoverage") },
          ]}
          onChange={(v) => update("defaultTier", v)}
        />
      </div>

      <div className="flex items-center justify-between py-4 gap-4">
        <div>
          <span className="text-[14px] font-semibold block">{t("account.settings.stealthMode")}</span>
          <span className="text-[13px] text-[var(--text-secondary)]">
            {t("account.settings.stealthHint")}
          </span>
        </div>
        <Switch
          checked={prefs.stealthMode}
          onChange={() => update("stealthMode", !prefs.stealthMode)}
          accent
        />
      </div>

      <div className="py-4">
        <p className="meta-text mb-2">{t("account.settings.account")}</p>
        {user ? (
          <div className="flex items-center justify-between gap-3">
            <span className="text-[14px] text-[var(--text-secondary)] truncate">{user.email}</span>
            <button type="button" onClick={onSignOut} className="btn-ghost shrink-0">
              {t("account.signOut")}
            </button>
          </div>
        ) : (
          <div>
            <p className="text-[13px] text-[var(--text-secondary)] mb-3">
              {t("account.settings.optionalSignIn")}
            </p>
            <Link href="/login" className="btn-primary text-[13px] h-9 px-4 inline-flex items-center">
              {t("account.settings.signInUp")}
            </Link>
          </div>
        )}
      </div>

      <div className="py-4">
        <button
          type="button"
          onClick={handleDelete}
          className="text-[13px] font-semibold text-[var(--accent)] hover:text-[var(--accent-hover)]"
        >
          {t("account.settings.deleteLocalData")}
        </button>
        <p className="text-[12px] text-[var(--text-secondary)] mt-1">
          {t("account.settings.deleteLocalHint")}
        </p>
      </div>
    </div>
  )
}
