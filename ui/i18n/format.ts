/**
 * Shared formatting helpers.
 *
 * Every function takes the locale explicitly. Nothing here reads ambient
 * state, so the same helper serves server components, client components,
 * Excel and PDF exports, and printable views — all of which need a locale
 * that is not "whatever the browser is set to".
 *
 * Time zone and currency are parameters with tenant defaults, never derived
 * from the locale: an English-reading dispatcher still sees Belgrade
 * departures priced in dinars.
 */

import { getFormattingLocale, getLocale, type SupportedLocale } from "./locales"
import enCommon from "./messages/en/common.json"
import srCommon from "./messages/sr/common.json"
import {
  DEFAULT_CURRENCY,
  DEFAULT_TIME_ZONE,
  getCurrencyFractionDigits,
  isBusinessDateShape,
  parseBusinessDate,
} from "./tenant"

/**
 * Calendar names and duration units, the only catalog text these helpers read.
 *
 * Imported here directly rather than through `messages.ts`: that module holds
 * every namespace, and a runtime `CATALOGS[locale][namespace]` lookup cannot
 * be tree-shaken, so importing it from a module client components reach would
 * put all eleven namespaces of both languages in the browser bundle. Only
 * `common` is reachable from here, and it is sent to every client anyway.
 *
 * `Record<SupportedLocale, ...>` is exhaustive, so adding a locale to the
 * registry fails type-checking until its catalog is added here too.
 */
const COMMON: Record<SupportedLocale, typeof srCommon> = { sr: srCommon, en: enCommon }

export type DateStyle = "short" | "medium" | "long"

type TimeZoneOption = { timeZone?: string }

const DATE_FORMATS: Record<DateStyle, Intl.DateTimeFormatOptions> = {
  short: { day: "2-digit", month: "2-digit", year: "numeric" },
  medium: { day: "numeric", month: "short", year: "numeric" },
  long: { day: "numeric", month: "long", year: "numeric" },
}

/**
 * Schedules are read as timetables in both languages, so times never switch to
 * a 12-hour clock — `en-US` would otherwise render "2:30 PM".
 */
const TIME_FORMAT: Intl.DateTimeFormatOptions = { hour: "2-digit", minute: "2-digit", hourCycle: "h23" }

const CLOCK_TIME = /^(\d{1,2}):(\d{2})(?::\d{2})?$/

function toDate(value: Date | string | number): Date {
  return value instanceof Date ? value : new Date(value)
}

function dateTimeFormat(
  locale: SupportedLocale,
  options: Intl.DateTimeFormatOptions,
  timeZone = DEFAULT_TIME_ZONE
): Intl.DateTimeFormat {
  return new Intl.DateTimeFormat(getFormattingLocale(locale), { timeZone, ...options })
}

/* -------------------------------------------------------------------------- */
/* Dates                                                                      */
/* -------------------------------------------------------------------------- */

/**
 * A calendar date the business already committed to — a departure date, a
 * report day — given as `YYYY-MM-DD`.
 *
 * Formatted with the clock pinned to UTC so the date can never shift: these
 * strings carry no time of day, and rendering one through any zone risks
 * moving a departure to the previous or next day.
 *
 * A string that is not a real calendar date is returned untouched rather than
 * silently displayed as the day it would roll over to.
 */
export function formatBusinessDate(
  businessDate: string,
  locale: SupportedLocale,
  options: { style?: DateStyle } = {}
): string {
  const asUtc = parseBusinessDate(businessDate)
  if (!asUtc) return businessDate
  return dateTimeFormat(locale, DATE_FORMATS[options.style ?? "long"], "UTC").format(asUtc)
}

export function formatDate(
  value: Date | string | number,
  locale: SupportedLocale,
  options: TimeZoneOption & { style?: DateStyle } = {}
): string {
  // A bare `YYYY-MM-DD` is a calendar date, not an instant, so it must not be
  // pushed through a timezone on the way to the screen.
  if (typeof value === "string" && isBusinessDateShape(value)) {
    return formatBusinessDate(value, locale, { style: options.style })
  }
  const { style = "long", timeZone } = options
  return dateTimeFormat(locale, DATE_FORMATS[style], timeZone).format(toDate(value))
}

export function formatDateTime(
  value: Date | string | number,
  locale: SupportedLocale,
  options: TimeZoneOption & { style?: DateStyle } = {}
): string {
  const { style = "long", timeZone } = options
  return dateTimeFormat(locale, { ...DATE_FORMATS[style], ...TIME_FORMAT }, timeZone).format(toDate(value))
}

/** Time of day of an instant, rendered in the tenant's timezone. */
export function formatTime(
  value: Date | string | number,
  locale: SupportedLocale,
  options: TimeZoneOption = {}
): string {
  return dateTimeFormat(locale, TIME_FORMAT, options.timeZone).format(toDate(value))
}

/**
 * Normalise a stored wall-clock time such as a departure time.
 *
 * These are timetable entries, not instants: "07:30" means 07:30 at the
 * station regardless of the reader's locale or the day's UTC offset, so this
 * deliberately never touches `Date`.
 */
export function formatClockTime(value: string): string {
  const match = CLOCK_TIME.exec(value.trim())
  if (!match) return value
  return `${match[1].padStart(2, "0")}:${match[2]}`
}

/**
 * Duration in minutes as "2h 15min" / "2h" / "15min".
 *
 * The unit abbreviations are catalog text like any other label, so a language
 * that does not abbreviate hours as "h" can change them without touching a
 * call site. The composition — number, unit, parts joined by a space — is
 * shared; a language that needs a different one is a reason to widen the
 * catalog shape, not to hard-code a second arrangement here.
 */
export function formatDuration(
  minutes: number | null | undefined,
  locale: SupportedLocale
): string | null {
  if (!minutes || minutes <= 0) return null
  const units = COMMON[locale].duration
  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60
  const parts: string[] = []
  if (hours > 0) parts.push(`${hours}${units.hour}`)
  if (rest > 0) parts.push(`${rest}${units.minute}`)
  return parts.join(" ")
}

/* -------------------------------------------------------------------------- */
/* Numbers and money                                                          */
/* -------------------------------------------------------------------------- */

export function formatNumber(
  value: number,
  locale: SupportedLocale,
  options: Intl.NumberFormatOptions = {}
): string {
  return new Intl.NumberFormat(getFormattingLocale(locale), options).format(value)
}

/**
 * Currency follows the tenant, not the reader: the code stays `RSD` in every
 * locale and only grouping, decimal separator, and symbol placement change.
 */
export function formatCurrency(
  value: number,
  locale: SupportedLocale,
  options: Intl.NumberFormatOptions & { currency?: string } = {}
): string {
  const { currency = DEFAULT_CURRENCY, ...rest } = options
  const digits = getCurrencyFractionDigits(currency)
  return new Intl.NumberFormat(getFormattingLocale(locale), {
    style: "currency",
    currency,
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
    ...rest,
  }).format(value)
}

export function formatPercent(
  value: number,
  locale: SupportedLocale,
  options: Intl.NumberFormatOptions = {}
): string {
  return new Intl.NumberFormat(getFormattingLocale(locale), {
    style: "percent",
    maximumFractionDigits: 1,
    ...options,
  }).format(value)
}

/* -------------------------------------------------------------------------- */
/* Lists                                                                      */
/* -------------------------------------------------------------------------- */

export function formatList(
  items: readonly string[],
  locale: SupportedLocale,
  options: Intl.ListFormatOptions = {}
): string {
  return new Intl.ListFormat(getFormattingLocale(locale), {
    type: "conjunction",
    style: "long",
    ...options,
  }).format(items)
}

/* -------------------------------------------------------------------------- */
/* Plurals                                                                    */
/* -------------------------------------------------------------------------- */

export type PluralCategory = Intl.LDMLPluralRule

/**
 * The CLDR plural category for a count. Messages use ICU `plural` blocks; this
 * exists for the places that pick between non-message variants, such as an
 * icon or a column width.
 */
export function getPluralCategory(
  count: number,
  locale: SupportedLocale,
  options: Intl.PluralRulesOptions = {}
): PluralCategory {
  return new Intl.PluralRules(getFormattingLocale(locale), options).select(count)
}

/* -------------------------------------------------------------------------- */
/* Calendar                                                                   */
/* -------------------------------------------------------------------------- */

export type CalendarNameWidth = "long" | "short" | "narrow"

export type WeekdayName = {
  /** `Date#getDay` index, so callers can key off a date directly. */
  index: number
  label: string
}

/**
 * Weekday and month names come from the catalogs rather than `Intl`, because
 * the product capitalises them ("Ponedeljak", not CLDR's "ponedeljak") and
 * translators need one place to adjust them.
 */
export function getWeekdayNames(
  locale: SupportedLocale,
  options: { width?: CalendarNameWidth; startOfWeek?: 0 | 1 } = {}
): WeekdayName[] {
  const { width = "long" } = options
  const names = COMMON[locale].weekdays[width]
  const start = options.startOfWeek ?? getFirstDayOfWeek(locale)
  return Array.from({ length: 7 }, (_, offset) => {
    const index = (start + offset) % 7
    return { index, label: names[index] }
  })
}

export function getWeekdayName(
  dayIndex: number,
  locale: SupportedLocale,
  width: CalendarNameWidth = "long"
): string {
  return COMMON[locale].weekdays[width][((dayIndex % 7) + 7) % 7]
}

export function getMonthNames(
  locale: SupportedLocale,
  width: Exclude<CalendarNameWidth, "narrow"> = "long"
): string[] {
  return [...COMMON[locale].months[width]]
}

export function getFirstDayOfWeek(locale: SupportedLocale): 0 | 1 {
  return getLocale(locale).firstDayOfWeek
}

/** Weekday indices as a readable list, e.g. "Pon, Sre i Pet". */
export function formatWeekdays(
  dayIndices: readonly number[],
  locale: SupportedLocale,
  options: { width?: CalendarNameWidth; type?: Intl.ListFormatOptions["type"] } = {}
): string {
  const { width = "short", type = "conjunction" } = options
  const start = getFirstDayOfWeek(locale)
  const ordered = [...dayIndices].sort((a, b) => ((a - start + 7) % 7) - ((b - start + 7) % 7))
  return formatList(
    ordered.map((day) => getWeekdayName(day, locale, width)),
    locale,
    { type }
  )
}

/* -------------------------------------------------------------------------- */
/* Sorting                                                                    */
/* -------------------------------------------------------------------------- */

/**
 * Serbian Latin orders č, ć, dž, đ and š after their base letters, which a
 * plain `<` comparison gets wrong. Collators are cached because constructing
 * one per comparison dominates the cost of sorting a passenger list.
 */
const collatorCache = new Map<string, Intl.Collator>()

export function getCollator(
  locale: SupportedLocale,
  options: Intl.CollatorOptions = {}
): Intl.Collator {
  const key = `${locale}:${JSON.stringify(options)}`
  let collator = collatorCache.get(key)
  if (!collator) {
    collator = new Intl.Collator(getFormattingLocale(locale), {
      sensitivity: "base",
      numeric: true,
      ...options,
    })
    collatorCache.set(key, collator)
  }
  return collator
}

export function compareStrings(
  a: string,
  b: string,
  locale: SupportedLocale,
  options?: Intl.CollatorOptions
): number {
  return getCollator(locale, options).compare(a, b)
}

/** Sort a copy of `items` by a string key using locale-aware collation. */
export function sortByString<T>(
  items: readonly T[],
  selector: (item: T) => string,
  locale: SupportedLocale,
  options?: Intl.CollatorOptions
): T[] {
  const collator = getCollator(locale, options)
  return [...items].sort((a, b) => collator.compare(selector(a), selector(b)))
}
