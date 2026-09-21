import { SUPPORTED_LOCALES, type SupportedLocale } from "./locales"

/**
 * Language negotiation from an `Accept-Language` header.
 *
 * This is the only place a browser's preference is consulted, and it runs on
 * exactly one URL — `/`. Every other path states its language in the URL, so
 * a shared link opens the same way for everyone who follows it.
 */

type Preference = {
  /** Primary subtag, lowercased: `en` for both `en` and `en-GB`. */
  language: string
  quality: number
  /** Position in the header, used to keep equal qualities in header order. */
  order: number
}

/** `q=` values outside this range are malformed; the entry is dropped. */
const MAX_QUALITY = 1

/**
 * Pick the best supported locale from an `Accept-Language` header.
 *
 * - Regional variants match their language: `en-GB` and `en-US` both select
 *   English, because the registry ships one English catalog.
 * - Weights are respected, so `sr;q=0.2, en;q=0.9` selects English even
 *   though Serbian is listed first.
 * - `q=0` is a rejection, not a weak preference: the language is skipped
 *   entirely rather than treated as a last resort.
 * - `*` carries no information about which of our locales to pick, so it is
 *   ignored and the caller falls back to the default.
 *
 * Returns `null` when the header is missing, malformed, or names no locale
 * this product ships.
 */
export function negotiateLocale(header: string | null | undefined): SupportedLocale | null {
  if (!header) return null

  const preferences = parseAcceptLanguage(header)
  if (preferences.length === 0) return null

  preferences.sort((a, b) => b.quality - a.quality || a.order - b.order)

  for (const preference of preferences) {
    const match = SUPPORTED_LOCALES.find((locale) => locale === preference.language)
    if (match) return match
  }

  return null
}

function parseAcceptLanguage(header: string): Preference[] {
  const preferences: Preference[] = []

  header.split(",").forEach((entry, order) => {
    const [rawTag, ...parameters] = entry.split(";")
    const tag = rawTag.trim().toLowerCase()
    // `*` matches anything, which tells us nothing about which catalog to
    // serve. An empty tag comes from a trailing or doubled comma.
    if (tag === "" || tag === "*") return

    // A tag is subtags joined by hyphens; the first is the language. Reject
    // anything else so a header of punctuation cannot select a locale.
    const language = tag.split("-")[0]
    if (!/^[a-z]{2,3}$/.test(language)) return

    const quality = parseQuality(parameters)
    // `q=0` means "not acceptable". Honouring it matters: a reader who has
    // explicitly rejected English should get Serbian, not English.
    if (quality === null || quality <= 0) return

    preferences.push({ language, quality, order })
  })

  return preferences
}

function parseQuality(parameters: string[]): number | null {
  const weight = parameters
    .map((parameter) => parameter.trim().toLowerCase())
    .find((parameter) => parameter.startsWith("q="))

  if (!weight) return MAX_QUALITY

  const quality = Number(weight.slice(2))
  if (!Number.isFinite(quality) || quality < 0 || quality > MAX_QUALITY) return null

  return quality
}
