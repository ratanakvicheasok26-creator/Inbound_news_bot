"use client"

import { createContext, useContext, useEffect, useMemo, useCallback, useSyncExternalStore, type ReactNode } from "react"
import { supabase } from "@/lib/supabase"
import { getProfile, updatePreferences, syncPreferencesToSupabase } from "@/lib/profile"
import { DEFAULT_LOCALE, detectLocale, isLocale, translate } from "./index"
import type { Locale } from "./dictionaries"

/** localStorage key used for the visitor (guest) language preference. */
export const LOCALE_KEY = "ib_locale"

interface I18nContextValue {
  locale: Locale
  setLocale: (locale: Locale) => void
  /** Translate a dot-path dictionary key into the active locale. */
  t: (path: string, params?: Record<string, string | number>) => string
}

const I18nContext = createContext<I18nContextValue | null>(null)

/** Custom event fired whenever the locale preference changes (or syncs). */
const LOCALE_EVENT = "ib:localechange"

function readLocale(): Locale {
  if (typeof window === "undefined") return DEFAULT_LOCALE
  try {
    const stored = localStorage.getItem(LOCALE_KEY)
    if (isLocale(stored)) return stored
    const profileLang = getProfile().preferences?.defaultLang
    if (isLocale(profileLang)) return profileLang
  } catch {
    // ignore — fall through to browser language
  }
  return detectLocale(null, typeof navigator !== "undefined" ? navigator.language : null)
}

function subscribeLocale(callback: () => void): () => void {
  window.addEventListener("storage", callback)
  document.addEventListener(LOCALE_EVENT, callback)
  return () => {
    window.removeEventListener("storage", callback)
    document.removeEventListener(LOCALE_EVENT, callback)
  }
}

/**
 * Global UI-language provider. Wraps the whole app. Persists the preference to
 * localStorage (guests) and to the existing `profiles.default_lang` column
 * (logged-in users) via the existing profile sync helpers — no new tables.
 *
 * The active locale lives in an external store (localStorage), read through
 * `useSyncExternalStore`: the server render uses the English snapshot, then
 * the client hydrates with the stored locale without a hydration mismatch.
 */
export function LocaleProvider({ children }: { children: ReactNode }) {
  const locale = useSyncExternalStore(subscribeLocale, readLocale, () => DEFAULT_LOCALE)

  const setLocale = useCallback((next: Locale) => {
    try {
      localStorage.setItem(LOCALE_KEY, next)
      updatePreferences({ defaultLang: next })
    } catch {
      // ignore storage errors
    }
    void syncPreferencesToSupabase()
    document.dispatchEvent(new Event(LOCALE_EVENT))
  }, [])

  // Keep <html lang> and a server-readable cookie in sync with the locale.
  useEffect(() => {
    document.documentElement.lang = locale
    try {
      document.cookie = `locale=${locale}; path=/; max-age=31536000; SameSite=Lax`
    } catch {
      // ignore cookie errors
    }
  }, [locale])

  // Signed-in users: prefer the language stored on their existing profile row,
  // and re-resolve when they sign in from another device.
  useEffect(() => {
    let active = true
    const applyProfileLang = async () => {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession()
        if (!session) return
        const { data } = await supabase
          .from("profiles")
          .select("default_lang")
          .eq("id", session.user.id)
          .maybeSingle()
        if (active && data?.default_lang && isLocale(data.default_lang)) {
          setLocale(data.default_lang)
        }
      } catch {
        // ignore
      }
    }
    void applyProfileLang()
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_IN") void applyProfileLang()
    })
    return () => {
      active = false
      sub.subscription.unsubscribe()
    }
  }, [setLocale])

  const t = useCallback(
    (path: string, params?: Record<string, string | number>) => translate(path, locale, params),
    [locale]
  )

  const value = useMemo(() => ({ locale, setLocale, t }), [locale, setLocale, t])

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}

export function useI18n(): I18nContextValue {
  const ctx = useContext(I18nContext)
  if (!ctx) throw new Error("useI18n must be used within <LocaleProvider>")
  return ctx
}
