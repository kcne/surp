/**
 * Tenant-scoped time and money rules.
 *
 * These are deliberately kept out of `locales.ts`: a tenant's timezone and
 * currency describe where the agency operates, not what language an employee
 * reads. Switching language must never move a departure or re-denominate a
 * price.
 */

/** Fallback for tenants that have no timezone recorded yet. */
export const DEFAULT_TIME_ZONE = "Europe/Belgrade"

/** The only currency the product bills in today. */
export const DEFAULT_CURRENCY = "RSD"

/**
 * Fraction digits are pinned rather than left to CLDR, which has changed its
 * default for RSD between ICU releases — the same price rendered 1.501 RSD on
 * one Node version and 1.500,50 RSD on another. Prices must not depend on
 * which runtime happens to render them, and the ICU presets in `formats.ts`
 * must not disagree with `formatCurrency`.
 */
const CURRENCY_FRACTION_DIGITS: Record<string, number> = {
  // Dinar prices are whole dinars throughout the product.
  RSD: 0,
}

const DEFAULT_FRACTION_DIGITS = 2

/**
 * Fraction digits a currency is always rendered with, on every runtime.
 *
 * The code is upper-cased first: `Intl.NumberFormat` canonicalises "rsd" and
 * would price it in dinars, so a lookup miss here would silently give those
 * call sites two decimal places.
 */
export function getCurrencyFractionDigits(currency: string = DEFAULT_CURRENCY): number {
  return CURRENCY_FRACTION_DIGITS[currency.toUpperCase()] ?? DEFAULT_FRACTION_DIGITS
}

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/

/**
 * True when a string has the `YYYY-MM-DD` shape — whether or not it names a
 * real calendar day. Used to decide that a value is a business date at all;
 * `parseBusinessDate` decides whether it is a valid one.
 */
export function isBusinessDateShape(value: string): boolean {
  return ISO_DATE.test(value)
}

/**
 * Strict `YYYY-MM-DD` parse, returning midnight UTC on that day, or `null`
 * when the string is not a real calendar date.
 *
 * `Date.UTC` rolls out-of-range components over silently — `2025-02-30`
 * becomes March 2 — so the parsed date is compared back against the input
 * before it is handed to anything that computes or displays it.
 */
export function parseBusinessDate(value: string): Date | null {
  const match = ISO_DATE.exec(value)
  if (!match) return null

  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  const date = new Date(Date.UTC(year, month - 1, day))

  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null
  }

  return date
}

function toDate(value: Date | string | number): Date {
  return value instanceof Date ? value : new Date(value)
}

/**
 * The calendar date a timestamp falls on for the tenant — the date an employee
 * would write on a passenger list. Independent of the viewer's language and of
 * the browser's own timezone.
 */
export function toBusinessDate(value: Date | string | number, timeZone = DEFAULT_TIME_ZONE): string {
  const date = toDate(value)
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date)

  const lookup = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? ""

  return `${lookup("year")}-${lookup("month")}-${lookup("day")}`
}

/** Offset of `timeZone` from UTC at a given instant, in minutes east of UTC. */
export function getTimeZoneOffsetMinutes(value: Date | string | number, timeZone = DEFAULT_TIME_ZONE): number {
  const date = toDate(value)
  // `en-CA` + `formatToParts` gives a stable, parseable wall-clock reading.
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(date)

  const lookup = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((part) => part.type === type)?.value ?? "0")

  const asUtc = Date.UTC(
    lookup("year"),
    lookup("month") - 1,
    lookup("day"),
    lookup("hour"),
    lookup("minute"),
    lookup("second")
  )

  return (asUtc - Math.floor(date.getTime() / 1000) * 1000) / 60000
}

function isWallClockComponent(value: number, max: number): boolean {
  return Number.isInteger(value) && value >= 0 && value <= max
}

/**
 * The instant at which a business date starts for the tenant.
 *
 * Resolved in two passes because the offset that applies depends on the
 * instant we are still computing — the single pass is wrong on the two days a
 * year the offset changes.
 */
export function fromBusinessDate(
  businessDate: string,
  timeZone = DEFAULT_TIME_ZONE,
  wallClock: { hour?: number; minute?: number } = {}
): Date {
  const midnight = parseBusinessDate(businessDate)
  if (!midnight) {
    throw new TypeError(`Expected a YYYY-MM-DD business date, received "${businessDate}"`)
  }

  const hour = wallClock.hour ?? 0
  const minute = wallClock.minute ?? 0
  if (!isWallClockComponent(hour, 23) || !isWallClockComponent(minute, 59)) {
    throw new TypeError(`Expected a 24-hour wall-clock time, received ${hour}:${minute}`)
  }

  const naive = midnight.getTime() + (hour * 60 + minute) * 60000

  const firstGuess = new Date(naive - getTimeZoneOffsetMinutes(naive, timeZone) * 60000)
  return new Date(naive - getTimeZoneOffsetMinutes(firstGuess, timeZone) * 60000)
}

/** True when both instants fall on the same business date for the tenant. */
export function isSameBusinessDate(
  a: Date | string | number,
  b: Date | string | number,
  timeZone = DEFAULT_TIME_ZONE
): boolean {
  return toBusinessDate(a, timeZone) === toBusinessDate(b, timeZone)
}
