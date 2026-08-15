import { dictionaries, DEFAULT_LOCALE, type Dictionary, type Locale } from "./dictionaries"

export type { Dictionary, DictionaryKey, SectionKey } from "./dictionaries"
export { LOCALES, DEFAULT_LOCALE, LOCALE_NAMES, isLocale } from "./dictionaries"

export function getDictionary(locale: Locale): Dictionary {
  return (dictionaries[locale] ?? dictionaries.en) as unknown as Dictionary
}

/** Resolve a dot-path key like "nav.home" against a dictionary. */
export function lookup(dict: Dictionary, path: string): string | undefined {
  let node: unknown = dict
  for (const part of path.split(".")) {
    if (node == null || typeof node !== "object") return undefined
    node = (node as Record<string, unknown>)[part]
  }
  return typeof node === "string" ? node : undefined
}

/**
 * Translate a dot-path UI key into the given locale, falling back to English
 * and then to the raw key so the interface never renders an empty string.
 * Supports `{placeholder}` interpolation via the optional params argument.
 */
export function translate(path: string, locale: Locale, params?: Record<string, string | number>): string {
  const active = getDictionary(locale)
  const fallback = dictionaries.en
  const text =
    lookup(active as unknown as Dictionary, path) ??
    lookup(fallback as unknown as Dictionary, path) ??
    path
  if (!params) return text
  return text.replace(/\{(\w+)\}/g, (match, name) =>
    name in params ? String(params[name]) : match
  )
}

export function detectLocale(stored: string | null | undefined, browser: string | null | undefined): Locale {
  if (stored === "en" || stored === "km") return stored
  if (browser && browser.toLowerCase().startsWith("km")) return "km"
  return DEFAULT_LOCALE
}
