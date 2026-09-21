import { getRequestConfig } from "next-intl/server"

import { formats } from "./formats"
import { getFormattingLocale } from "./locales"
import { loadMessages } from "./messages"
import {
  messageFallback,
  reportIntlError,
  reportMessageFallback,
} from "./reporting"
import { localeFromSegment } from "./routing"
import { DEFAULT_TIME_ZONE } from "./tenant"

export default getRequestConfig(async ({ requestLocale }) => {
  // next-intl reads this from the `[locale]` segment, so the config stays
  // available to statically rendered pages.
  const locale = localeFromSegment(await requestLocale)
  const { messages, fallbacks } = loadMessages(locale)

  for (const fallback of fallbacks) {
    reportMessageFallback(fallback)
  }

  return {
    // next-intl formats the values inside ICU messages with this tag, so it
    // gets the formatting locale rather than the registry key.
    locale: getFormattingLocale(locale),
    messages,
    formats,
    // Tenant time, not reader time: a browser in another timezone must not
    // shift a departure. Narrowed per tenant by later issues.
    timeZone: DEFAULT_TIME_ZONE,
    onError: (error) => reportIntlError(locale, error),
    getMessageFallback: messageFallback,
  }
})
