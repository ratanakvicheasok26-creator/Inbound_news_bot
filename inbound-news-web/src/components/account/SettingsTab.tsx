"use client"

import { useState } from "react"
import { getProfile, updatePreferences, resetProfile, syncPreferencesToSupabase } from "@/lib/profile"
import type { User } from "@supabase/supabase-js"

interface SettingsTabProps {
  user: User
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
  const [prefs, setPrefs] = useState(() => getProfile().preferences)

  function update<K extends keyof typeof prefs>(key: K, value: (typeof prefs)[K]) {
    const next = { ...prefs, [key]: value }
    setPrefs(next)
    updatePreferences({ [key]: value })
    syncPreferencesToSupabase()
  }

  function handleDelete() {
    if (confirm("This will erase your reading history, score, and saved stories. Continue?")) {
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
        <label className="meta-text">Default tier</label>
        <Segmented
          value={prefs.defaultTier}
          options={[
            { id: "eli5", label: "ELI5" },
            { id: "standard", label: "Standard" },
            { id: "deep", label: "Deep" },
          ]}
          onChange={(v) => update("defaultTier", v)}
        />
      </div>

      <div className="flex items-center justify-between py-4 gap-4">
        <div>
          <span className="text-[14px] font-semibold block">Stealth mode</span>
          <span className="text-[13px] text-[var(--text-secondary)]">
            Stop recording history and points
          </span>
        </div>
        <Switch
          checked={prefs.stealthMode}
          onChange={() => update("stealthMode", !prefs.stealthMode)}
          accent
        />
      </div>

      <div className="py-4">
        <p className="meta-text mb-2">Account</p>
        <div className="flex items-center justify-between gap-3">
          <span className="text-[14px] text-[var(--text-secondary)] truncate">{user.email}</span>
          <button type="button" onClick={onSignOut} className="btn-ghost shrink-0">
            Sign out
          </button>
        </div>
      </div>

      <div className="py-4">
        <button
          type="button"
          onClick={handleDelete}
          className="text-[13px] font-semibold text-[var(--accent)] hover:text-[var(--accent-hover)]"
        >
          Delete local data
        </button>
        <p className="text-[12px] text-[var(--text-secondary)] mt-1">
          Erase reading history, score, and saved stories from this device.
        </p>
      </div>
    </div>
  )
}
