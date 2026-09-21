import { type SupportedLocale } from "./locales"
import { localeFromSegment } from "./routing"

/**
 * The locale of the current request, read from the `[locale]` route param.
 *
 * Reading the param rather than a header or a cookie is what keeps marketing
 * pages statically renderable: the segment is part of the route, so Next can
 * prerender one copy per language at build time. Anything that reached for
 * request state instead would make every page dynamic.
 *
 * The middleware only ever rewrites to a registered locale, so an unexpected
 * value means the segment was reached another way; it resolves to the default
 * rather than throwing.
 */
export function resolveRequestLocale(params: { locale?: string }): SupportedLocale {
  return localeFromSegment(params.locale)
}
