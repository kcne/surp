import { getRequestConfig } from "next-intl/server"

import { formats } from "./formats"
import { getFormattingLocale } from "./locales"
import { loadMessages } from "./messages"
import {
  messageFallback,
  reportIntlError,
  reportMessageFallback,
} from "./reporting"
import { resolveRequestLocale } from "./resolve-locale"
import { DEFAULT_TIME_ZONE } from "./tenant"

export default getRequestConfig(async () => {
  const locale = await resolveRequestLocale()
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
    // shift a departure. #67 onwards may narrow this per tenant.
    timeZone: DEFAULT_TIME_ZONE,
    onError: (error) => reportIntlError(locale, error),
    getMessageFallback: messageFallback,
  }
})
