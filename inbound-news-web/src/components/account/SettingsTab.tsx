"use client"

import { useState } from "react"
import { getProfile, updatePreferences, resetProfile, syncPreferencesToSupabase } from "@/lib/profile"
import type { User } from "@supabase/supabase-js"

interface SettingsTabProps {
  user: User
  onSignOut: () => void
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
    <div className="max-w-[560px]">
      {/* Default Language */}
      <div className="flex items-center justify-between py-4 border-b border-[var(--border)]">
        <label className="font-mono text-[11px] uppercase tracking-[0.06em] text-[var(--text-secondary)] font-bold">
          Default Language
        </label>
        <div className="flex border-2 border-[var(--text-primary)] overflow-hidden">
          <button
            onClick={() => update("defaultLang", "en")}
            className={`px-3 py-1.5 font-mono text-[11px] font-bold uppercase tracking-wider transition-colors ${
              prefs.defaultLang === "en"
                ? "bg-[var(--text-primary)] text-inverted"
                : "text-[var(--text-primary)] hover:bg-[var(--text-primary)] hover:text-inverted"
            }`}
          >
            EN
          </button>
          <div className="w-px bg-[var(--border)]" />
          <button
            onClick={() => update("defaultLang", "km")}
            className={`px-3 py-1.5 font-mono text-[11px] font-bold uppercase tracking-wider transition-colors ${
              prefs.defaultLang === "km"
                ? "bg-[var(--text-primary)] text-inverted"
                : "text-[var(--text-primary)] hover:bg-[var(--text-primary)] hover:text-inverted"
            }`}
          >
            ខ្មែរ
          </button>
        </div>
      </div>

      {/* Default Reading Tier */}
      <div className="flex items-center justify-between py-4 border-b border-[var(--border)]">
        <label className="font-mono text-[11px] uppercase tracking-[0.06em] text-[var(--text-secondary)] font-bold">
          Default Tier
        </label>
        <div className="flex border-2 border-[var(--text-primary)] overflow-hidden">
          {(["eli5", "standard", "deep"] as const).map((tier, i) => (
            <div key={tier} className="flex">
              {i > 0 && <div className="w-px bg-[var(--border)]" />}
              <button
                onClick={() => update("defaultTier", tier)}
                className={`px-3 py-1.5 font-mono text-[11px] font-bold uppercase tracking-wider transition-colors ${
                  prefs.defaultTier === tier
                    ? "bg-[var(--text-primary)] text-inverted"
                    : "text-[var(--text-primary)] hover:bg-[var(--text-primary)] hover:text-inverted"
                }`}
              >
                {tier === "eli5" ? "ELI5" : tier === "standard" ? "Standard" : "Deep"}
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Telegram Digest */}
      <div className="flex items-center justify-between py-4 border-b border-[var(--border)]">
        <div>
          <span className="font-mono text-[11px] uppercase tracking-[0.06em] text-[var(--text-secondary)] font-bold block">
            Telegram Digest
          </span>
          <span className="font-mono text-[10px] text-[var(--text-secondary)]">
            Receive daily digest via Telegram bot
          </span>
        </div>
        <button
          onClick={() => update("telegramDigest", !prefs.telegramDigest)}
          className={`w-11 h-6 border-2 border-[var(--text-primary)] relative transition-colors ${
            prefs.telegramDigest ? "bg-[var(--text-primary)]" : "bg-transparent"
          }`}
          role="switch"
          aria-checked={prefs.telegramDigest}
        >
          <div
            className={`absolute top-0.5 w-4 h-4 transition-transform ${
              prefs.telegramDigest
                ? "left-5 bg-[var(--bg)]"
                : "left-0.5 bg-[var(--text-primary)]"
            }`}
          />
        </button>
      </div>

      {/* Stealth Mode */}
      <div className="flex items-center justify-between py-4 border-b border-[var(--border)]">
        <div>
          <span className="font-mono text-[11px] uppercase tracking-[0.06em] text-[var(--text-secondary)] font-bold block">
            Stealth Mode
          </span>
          <span className="font-mono text-[10px] text-[var(--text-secondary)]">
            Stops recording reading history and literacy points
          </span>
        </div>
        <button
          onClick={() => update("stealthMode", !prefs.stealthMode)}
          className={`w-11 h-6 border-2 border-[var(--text-primary)] relative transition-colors ${
            prefs.stealthMode ? "bg-[var(--accent)]" : "bg-transparent"
          }`}
          role="switch"
          aria-checked={prefs.stealthMode}
        >
          <div
            className={`absolute top-0.5 w-4 h-4 transition-transform ${
              prefs.stealthMode
                ? "left-5 bg-[var(--accent-contrast)]"
                : "left-0.5 bg-[var(--text-primary)]"
            }`}
          />
        </button>
      </div>

      {/* Account Info */}
      <div className="pt-8 mt-4 border-t-2 border-[var(--text-primary)]">
        <h3 className="font-mono text-[11px] uppercase tracking-[0.06em] font-bold text-[var(--text-secondary)] mb-3">
          Account
        </h3>
        <div className="flex items-center justify-between py-3 border-b border-[var(--border)]">
          <span className="font-mono text-[11px] text-[var(--text-secondary)]">{user.email}</span>
          <button
            onClick={onSignOut}
            className="font-mono text-[11px] uppercase tracking-[0.06em] font-bold text-[var(--text-secondary)] border-2 border-[var(--border)] px-3 py-1 hover:border-[var(--accent)] hover:text-[var(--accent)] transition-colors"
          >
            Sign Out
          </button>
        </div>
      </div>

      {/* Delete Local Data */}
      <div className="pt-6 mt-4">
        <button
          onClick={handleDelete}
          className="font-mono text-[11px] uppercase tracking-[0.06em] font-bold text-[var(--accent)] hover:text-[var(--red-hover)] transition-colors"
        >
          Delete Local Data
        </button>
        <p className="font-mono text-[10px] text-[var(--text-secondary)] mt-1">
          Erase reading history, score, and saved stories from this device.
        </p>
      </div>
    </div>
  )
}
