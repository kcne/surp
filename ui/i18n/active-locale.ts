import { cache } from "react"

import { DEFAULT_LOCALE, type SupportedLocale } from "./locales"

/**
 * The locale of the render in progress, for the one surface that cannot be
 * given it any other way.
 *
 * `not-found.tsx` receives no route params, and the two obvious ways to hand
 * it a locale are both closed:
 *
 * - Reading request state (`headers()`, or next-intl's server APIs, which
 *   fall back to it) inside a `not-found.tsx` makes Next serve every route in
 *   that segment `no-store`, costing the public marketing pages the CDN
 *   caching they had before locales existed.
 * - A `not-found.tsx` that renders any client component is ignored by Next 14
 *   altogether, which falls back to its own untranslated 404 page.
 *
 * `cache()` is per-render, not per-request, and reading it is not a dynamic
 * API, so a statically prerendered page stays static. The root layout writes
 * the locale it resolved from its `[locale]` param, and the boundary below it
 * reads it back.
 *
 * Everything that has a route param should use that param instead.
 */
const store = cache((): { locale: SupportedLocale } => ({ locale: DEFAULT_LOCALE }))

export function setActiveLocale(locale: SupportedLocale): void {
  store().locale = locale
}

/**
 * The active locale, or the default when the layout has not run in this
 * render — a wrong language on a 404 is a better failure than a crash.
 */
export function getActiveLocale(): SupportedLocale {
  return store().locale
}
