import { DEFAULT_LOCALE, FALLBACK_LOCALE, type SupportedLocale } from "./locales"
import { MESSAGE_NAMESPACES, type MessageNamespace } from "./namespaces"

import srAuth from "./messages/sr/auth.json"
import srCommon from "./messages/sr/common.json"
import srDashboard from "./messages/sr/dashboard.json"
import srErrors from "./messages/sr/errors.json"
import srExports from "./messages/sr/exports.json"
import srMarketing from "./messages/sr/marketing.json"
import srPassengers from "./messages/sr/passengers.json"
import srReservations from "./messages/sr/reservations.json"
import srSchedules from "./messages/sr/schedules.json"
import srStorefront from "./messages/sr/storefront.json"
import srSuperAdmin from "./messages/sr/superAdmin.json"

import enAuth from "./messages/en/auth.json"
import enCommon from "./messages/en/common.json"
import enDashboard from "./messages/en/dashboard.json"
import enErrors from "./messages/en/errors.json"
import enExports from "./messages/en/exports.json"
import enMarketing from "./messages/en/marketing.json"
import enPassengers from "./messages/en/passengers.json"
import enReservations from "./messages/en/reservations.json"
import enSchedules from "./messages/en/schedules.json"
import enStorefront from "./messages/en/storefront.json"
import enSuperAdmin from "./messages/en/superAdmin.json"

/**
 * Every catalog is imported by name rather than through a dynamic
 * `import(\`./messages/${locale}/${ns}.json\`)`, so every shipped file is
 * statically reachable and an unregistered namespace cannot be requested.
 *
 * This does not tree-shake by locale: the lookup below is by runtime key, so
 * anything importing this module gets every catalog of every language. That
 * is fine here — this module is only reached from the server, where the
 * request already has the whole catalog set in memory. Keep it that way; a
 * client component that needs catalog text should receive it through
 * `NextIntlClientProvider`, and the helpers in `format.ts` deliberately
 * import `common` directly rather than going through here.
 */
const CATALOGS = {
  sr: {
    auth: srAuth,
    common: srCommon,
    dashboard: srDashboard,
    errors: srErrors,
    exports: srExports,
    marketing: srMarketing,
    passengers: srPassengers,
    reservations: srReservations,
    schedules: srSchedules,
    storefront: srStorefront,
    superAdmin: srSuperAdmin,
  },
  en: {
    auth: enAuth,
    common: enCommon,
    dashboard: enDashboard,
    errors: enErrors,
    exports: enExports,
    marketing: enMarketing,
    passengers: enPassengers,
    reservations: enReservations,
    schedules: enSchedules,
    storefront: enStorefront,
    superAdmin: enSuperAdmin,
  },
}

/**
 * Message shape used for key typing across the app. The default locale is the
 * source of truth: CI rejects any catalog whose keys diverge from it, so a key
 * that type-checks exists in every locale.
 */
export type AppMessages = (typeof CATALOGS)[typeof DEFAULT_LOCALE]

export type LoadedMessages = Partial<AppMessages>

export type MessageFallback = {
  locale: SupportedLocale
  namespace: MessageNamespace
  key: string
}

export type LoadMessagesResult = {
  messages: LoadedMessages
  /** Keys that had to be served from {@link FALLBACK_LOCALE}. Always empty in CI. */
  fallbacks: MessageFallback[]
}

type Node = Record<string, unknown>

function isPlainObject(value: unknown): value is Node {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

/**
 * Overlay `source` under `target`: keys present in `target` win, keys only in
 * `source` are copied in and reported. Merging before formatting — rather than
 * substituting a string at render time — keeps ICU arguments working when a
 * translation is missing.
 */
export function overlayMissing(
  target: unknown,
  source: unknown,
  path: string,
  onFallback: (key: string) => void
): unknown {
  if (!isPlainObject(source)) {
    return target === undefined ? source : target
  }

  if (!isPlainObject(target)) {
    if (target !== undefined) return target
    for (const key of collectLeafKeys(source, path)) onFallback(key)
    return source
  }

  const merged: Node = { ...target }
  for (const [key, sourceValue] of Object.entries(source)) {
    const childPath = path ? `${path}.${key}` : key
    if (!(key in merged) || merged[key] === undefined) {
      if (isPlainObject(sourceValue)) {
        for (const leaf of collectLeafKeys(sourceValue, childPath)) onFallback(leaf)
      } else {
        onFallback(childPath)
      }
      merged[key] = sourceValue
      continue
    }
    merged[key] = overlayMissing(merged[key], sourceValue, childPath, onFallback)
  }
  return merged
}

function collectLeafKeys(node: unknown, path: string): string[] {
  if (!isPlainObject(node)) return [path]
  return Object.entries(node).flatMap(([key, value]) =>
    collectLeafKeys(value, path ? `${path}.${key}` : key)
  )
}

/** The raw catalog for one namespace, without any fallback overlay applied. */
export function getCatalog<N extends MessageNamespace>(
  locale: SupportedLocale,
  namespace: N
): (typeof CATALOGS)[typeof DEFAULT_LOCALE][N] {
  return CATALOGS[locale][namespace] as (typeof CATALOGS)[typeof DEFAULT_LOCALE][N]
}

/**
 * Load the catalogs for one locale. Only the requested namespaces are
 * returned, so a route can hand a client boundary exactly what it renders.
 */
export function loadMessages(
  locale: SupportedLocale,
  namespaces: readonly MessageNamespace[] = MESSAGE_NAMESPACES
): LoadMessagesResult {
  const messages: Node = {}
  const fallbacks: MessageFallback[] = []

  for (const namespace of namespaces) {
    const catalog = CATALOGS[locale][namespace]
    if (locale === FALLBACK_LOCALE) {
      messages[namespace] = catalog
      continue
    }
    messages[namespace] = overlayMissing(catalog, CATALOGS[FALLBACK_LOCALE][namespace], "", (key) => {
      fallbacks.push({ locale, namespace, key })
    })
  }

  return { messages: messages as LoadedMessages, fallbacks }
}
