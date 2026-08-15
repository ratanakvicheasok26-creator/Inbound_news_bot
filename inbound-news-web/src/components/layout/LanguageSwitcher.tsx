"use client"

import { useI18n, LOCALE_KEY } from "@/lib/i18n/LocaleProvider"
import type { Locale } from "@/lib/i18n/dictionaries"

/**
 * English | ខ្មែរ language switcher. Free for every plan — the language of
 * the interface is never a paid feature. Persists through LocaleProvider.
 */
export function LanguageSwitcher({ className }: { className?: string }) {
  const { locale, setLocale } = useI18n()

  function pick(next: Locale) {
    if (next === locale) return
    // Keep the raw preference visible to the provider even if the profile
    // sync is slow; the provider reads this on mount.
    try {
      localStorage.setItem(LOCALE_KEY, next)
    } catch {
      // ignore
    }
    setLocale(next)
  }

  const base =
    "px-2.5 h-8 text-[12px] font-semibold uppercase tracking-wide transition-colors disabled:cursor-default"

  return (
    <div
      role="group"
      aria-label="Site language"
      className={`inline-flex items-center rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--surface)] overflow-hidden ${className ?? ""}`}
    >
      <button
        type="button"
        onClick={() => pick("en")}
        aria-pressed={locale === "en"}
        className={`${base} ${
          locale === "en"
            ? "bg-[var(--accent)] text-white"
            : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
        }`}
      >
        English
      </button>
      <button
        type="button"
        onClick={() => pick("km")}
        aria-pressed={locale === "km"}
        className={`${base} font-khmer ${
          locale === "km"
            ? "bg-[var(--accent)] text-white"
            : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
        }`}
      >
        ខ្មែរ
      </button>
    </div>
  )
}
