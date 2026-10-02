/** The longest range GET /departures serves in one request, both ends counted. */
export const DEPARTURE_WINDOW_DAYS = 62

export interface DateWindow {
  /** First service date, `YYYY-MM-DD`, included. */
  from: string
  /** Last service date, `YYYY-MM-DD`, included. */
  to: string
}

/** A `YYYY-MM-DD` date moved by whole days, without the local time zone. */
export function addDaysToIsoDate(date: string, days: number): string {
  const shifted = new Date(`${date}T00:00:00.000Z`)
  shifted.setUTCDate(shifted.getUTCDate() + days)
  return shifted.toISOString().slice(0, 10)
}

/**
 * Splits a range into the windows GET /departures accepts. Windows start at
 * `from` and step by the full length, so a range that grows at its end (the
 * schedule list's "show more") keeps the windows it already fetched.
 */
export function splitIntoDepartureWindows(range: DateWindow): DateWindow[] {
  if (!range.from || !range.to || range.to < range.from) {
    return []
  }

  const windows: DateWindow[] = []

  for (let from = range.from; from <= range.to; from = addDaysToIsoDate(from, DEPARTURE_WINDOW_DAYS)) {
    const end = addDaysToIsoDate(from, DEPARTURE_WINDOW_DAYS - 1)
    windows.push({ from, to: end < range.to ? end : range.to })
  }

  return windows
}

/**
 * The fewest windows that cover a scattered set of dates, each starting at a
 * date it covers, so dates far apart cost one request each and never the
 * months between them.
 */
export function windowsCoveringDates(dates: readonly string[]): DateWindow[] {
  const sorted = Array.from(new Set(dates.filter((date) => /^\d{4}-\d{2}-\d{2}$/.test(date)))).sort()
  const windows: DateWindow[] = []

  for (const date of sorted) {
    const current = windows[windows.length - 1]

    if (current && date <= addDaysToIsoDate(current.from, DEPARTURE_WINDOW_DAYS - 1)) {
      current.to = date
      continue
    }

    windows.push({ from: date, to: date })
  }

  return windows
}
