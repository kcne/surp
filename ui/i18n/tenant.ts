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

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/

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
  if (!ISO_DATE.test(businessDate)) {
    throw new TypeError(`Expected a YYYY-MM-DD business date, received "${businessDate}"`)
  }

  const [year, month, day] = businessDate.split("-").map(Number)
  const naive = Date.UTC(year, month - 1, day, wallClock.hour ?? 0, wallClock.minute ?? 0)

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
