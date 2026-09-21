import { createTranslator } from "next-intl"

import { getActiveLocale } from "@/i18n/active-locale"
import { getFormattingLocale, type SupportedLocale } from "@/i18n/locales"
import { loadMessages } from "@/i18n/messages"

/**
 * Translations for a `not-found.tsx`, which is the one surface that can reach
 * neither a route param nor next-intl's server APIs — see
 * `i18n/active-locale.ts` for why. Everything here is a pure function of the
 * active locale, so a statically prerendered page stays static.
 */
export function notFoundCopy(namespace: "app" | "public" | "storefront"): {
  locale: SupportedLocale
  t: (key: string) => string
} {
  const locale = getActiveLocale()
  const { messages } = loadMessages(locale, ["errors"])

  const translator = createTranslator({
    locale: getFormattingLocale(locale),
    messages,
    namespace: `errors.notFoundPage.${namespace}`,
  })

  // The namespace is picked at runtime, so next-intl cannot narrow the key
  // type to that block. The catalog CI gate is what keeps these keys honest.
  return { locale, t: translator as unknown as (key: string) => string }
}
