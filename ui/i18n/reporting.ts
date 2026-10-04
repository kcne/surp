import { IntlErrorCode } from "next-intl"

import { FALLBACK_LOCALE, type SupportedLocale } from "./locales"
import type { MessageFallback } from "./messages"

/**
 * What the product does about a message it could not resolve: how it is
 * logged, and what renders in its place.
 *
 * This lives apart from `request.ts` so it can be exercised without standing
 * up a request — `request.ts` is wiring, this is the policy.
 */

/**
 * Missing messages are reported once per key per process. Without the guard a
 * single missing string on a busy page floods the logs and hides the rest.
 */
const reported = new Set<string>()

function once(key: string, report: () => void): void {
  if (reported.has(key)) return
  reported.add(key)
  report()
}

/** A key the active catalog did not have, served from the fallback locale. */
export function reportMessageFallback({ locale, namespace, key }: MessageFallback): void {
  once(`fallback:${locale}:${namespace}.${key}`, () => {
    console.error(
      `[i18n] missing message: locale=${locale} key=${namespace}.${key} — served from "${FALLBACK_LOCALE}"`
    )
  })
}

/** A key that is missing from the fallback locale too, so nothing can be served. */
export function reportMissingMessage(locale: SupportedLocale, key: string): void {
  once(`missing:${locale}:${key}`, () => {
    console.error(`[i18n] missing message: locale=${locale} key=${key} — no fallback available`)
  })
}

/**
 * Route one error from next-intl. A missing message is expected enough to
 * have its own per-key reporting; anything else is a malformed message, which
 * is a bug in a catalog and should be loud every time.
 */
export function reportIntlError(
  locale: SupportedLocale,
  error: { code: string; message: string; originalMessage?: string }
): void {
  if (error.code === IntlErrorCode.MISSING_MESSAGE) {
    reportMissingMessage(locale, error.originalMessage ?? error.message)
    return
  }
  console.error(`[i18n] ${error.code}: ${error.message}`)
}

/**
 * What renders when a key exists in no catalog at all.
 *
 * The Serbian overlay in `loadMessages` already covers anything the active
 * catalog is missing, so reaching here means no locale has the key. Render
 * the path: obvious on screen, and greppable.
 */
export function messageFallback({ namespace, key }: { namespace?: string; key: string }): string {
  return namespace ? `${namespace}.${key}` : key
}

/** Test seam: clears the dedupe set. */
export function resetMessageReporting(): void {
  reported.clear()
}
