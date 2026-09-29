/**
 * The single registry of supported locales.
 *
 * Adding a locale means adding one entry here plus a complete set of message
 * catalogs under `i18n/messages/<locale>/`. Nothing else in the product — no
 * database enum, no routing rewrite, no per-user preference column — needs to
 * know about locales. See `docs/adding-a-locale.md`.
 */

export const SUPPORTED_LOCALES = ["sr", "en"] as const

export type SupportedLocale = (typeof SUPPORTED_LOCALES)[number]

export type LocaleDefinition = {
  /** Registry key, and the value stored in the language cookie. */
  locale: SupportedLocale
  /** BCP 47 tag handed to `Intl.*`. Never assume it equals `locale`. */
  formattingLocale: string
  /** Value for the `lang` attribute on `<html>`. */
  htmlLang: string
  /** Value for `openGraph.locale` in metadata. */
  ogLocale: string
  /** Name shown in the language switcher, written in the locale itself. */
  nativeName: string
  /** Name used in English-language docs, logs, and reports. */
  englishName: string
  /**
   * First day of the week as a `Date#getDay` index. Calendars read this
   * instead of `Intl.Locale#getWeekInfo`, which Node 20 does not implement.
   */
  firstDayOfWeek: 0 | 1
}

export const LOCALES: Record<SupportedLocale, LocaleDefinition> = {
  sr: {
    locale: "sr",
    // Plain `sr-RS` resolves to Cyrillic in CLDR, so the script subtag is
    // required to keep month and day names in Latin script.
    formattingLocale: "sr-Latn-RS",
    htmlLang: "sr-Latn",
    ogLocale: "sr_RS",
    nativeName: "Srpski",
    englishName: "Serbian",
    firstDayOfWeek: 1,
  },
  en: {
    locale: "en",
    formattingLocale: "en-US",
    htmlLang: "en",
    ogLocale: "en_US",
    nativeName: "English",
    englishName: "English",
    firstDayOfWeek: 0,
  },
}

export const DEFAULT_LOCALE: SupportedLocale = "sr"

/**
 * Locale used when a message is missing from the active catalog. CI rejects
 * incomplete catalogs, so this only ever covers an emergency.
 */
export const FALLBACK_LOCALE: SupportedLocale = DEFAULT_LOCALE

export function isSupportedLocale(value: unknown): value is SupportedLocale {
  return typeof value === "string" && (SUPPORTED_LOCALES as readonly string[]).includes(value)
}

export function getLocale(locale: SupportedLocale): LocaleDefinition {
  return LOCALES[locale]
}

/**
 * Resolve a registry key to the tag `Intl.*` expects.
 *
 * These differ on purpose: bare `sr` resolves to Cyrillic in CLDR, rendering
 * "септембар" and joining lists with "и". Everything that formats — `Intl`
 * directly, and next-intl, which formats the values inside ICU messages —
 * must be handed this tag rather than the registry key.
 */
export function getFormattingLocale(locale: SupportedLocale): string {
  return LOCALES[locale].formattingLocale
}

/**
 * Map a formatting tag back to its registry key, which is what the app stores
 * in cookies, puts in URLs, and passes to the helpers.
 */
export function toAppLocale(tag: string): SupportedLocale {
  if (isSupportedLocale(tag)) return tag
  const match = SUPPORTED_LOCALES.find((locale) => LOCALES[locale].formattingLocale === tag)
  return match ?? DEFAULT_LOCALE
}
