import type { formats } from "./formats"
import type { AppMessages } from "./messages"

/**
 * Teaches `useTranslations`, `getTranslations`, and `useFormatter` about this
 * app's message keys and named formats, so a typo in a key or a format name
 * fails the build instead of rendering at runtime.
 *
 * `Locale` is deliberately left as `string`: next-intl holds the formatting
 * tag ("sr-Latn-RS"), not the registry key ("sr"). Use `toAppLocale` from
 * `./locales` to get back to the registry key.
 */
declare module "next-intl" {
  interface AppConfig {
    Messages: AppMessages
    Formats: typeof formats
  }
}
