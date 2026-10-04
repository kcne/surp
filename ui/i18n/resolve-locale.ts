import { DEFAULT_LOCALE, type SupportedLocale } from "./locales"

/**
 * The locale for the current request.
 *
 * Every unprefixed URL serves Serbian, which is the registry's default, so
 * today this returns it directly and the rendered output is unchanged. The
 * `/en` prefix and the language detection that applies at `/` are added in
 * #67; this function is the single seam they replace, so no caller has to
 * change when they land.
 */
export async function resolveRequestLocale(): Promise<SupportedLocale> {
  return DEFAULT_LOCALE
}
