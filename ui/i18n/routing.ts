import {
  DEFAULT_LOCALE,
  SUPPORTED_LOCALES,
  isSupportedLocale,
  type SupportedLocale,
} from "./locales"

/**
 * URL shape for locales.
 *
 * Serbian is unprefixed, so every link that shipped before this module keeps
 * working: `/cene` is Serbian and stays Serbian forever. English adds a `/en`
 * segment. Slugs are never translated — `/en/cene`, not `/en/pricing` — so a
 * page has exactly one path per language and the sitemap stays derivable.
 *
 * `/sr/...` is accepted but not canonical: it redirects to the unprefixed
 * path so the same page is never reachable at two URLs.
 */

/**
 * Cookie holding the reader's saved language. Only the language switcher
 * (#68) writes it; opening a link never does. The name matches next-intl's
 * default so its client helpers read the same value.
 */
export const LOCALE_COOKIE_NAME = "NEXT_LOCALE"

/** Locales that appear as a URL segment. Serbian is unprefixed. */
export const PREFIXED_LOCALES = SUPPORTED_LOCALES.filter(
  (locale) => locale !== DEFAULT_LOCALE,
)

/**
 * Split a pathname into its locale segment and the rest.
 *
 * Matching is per segment, not by string prefix: `/srbija-tours` is an agency
 * slug that happens to start with "sr", not the Serbian home page.
 */
export function splitLocaleSegment(pathname: string): {
  segment: SupportedLocale | null
  rest: string
} {
  const match = /^\/([^/]+)(\/.*)?$/.exec(pathname)
  if (!match) return { segment: null, rest: pathname }

  const [, first, tail] = match
  if (!isSupportedLocale(first)) return { segment: null, rest: pathname }

  return { segment: first, rest: tail && tail !== "/" ? tail : "/" }
}

/**
 * The path a locale's copy of `pathname` lives at, where `pathname` is
 * already unprefixed. Used by the middleware's rewrite and by any link that
 * has to cross languages.
 */
export function localizePathname(
  locale: SupportedLocale,
  pathname: string,
): string {
  const normalized = pathname === "" ? "/" : pathname
  if (locale === DEFAULT_LOCALE) return normalized
  return normalized === "/" ? `/${locale}` : `/${locale}${normalized}`
}

/**
 * The locale a request is being served in, given the `[locale]` route param.
 *
 * The middleware only ever rewrites to a registered locale, so an unknown
 * value means the segment was reached some other way; it falls back to the
 * default rather than throwing, because a 500 on a marketing page is worse
 * than a page in the wrong language.
 */
export function localeFromSegment(value: unknown): SupportedLocale {
  return isSupportedLocale(value) ? value : DEFAULT_LOCALE
}

/**
 * The locale saved in the language cookie, or `null` when it is absent or
 * holds a value the registry does not know. A stale cookie naming a locale
 * that has since been removed must not win over the browser's preferences.
 */
export function localeFromCookie(value: string | undefined): SupportedLocale | null {
  return isSupportedLocale(value) ? value : null
}
