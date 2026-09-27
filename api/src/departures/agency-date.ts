/**
 * The agency's calendar, which is what "past" means for a departure.
 *
 * A departure is past once its service date is before the agency's local date.
 * Today is not past: a same-day timetable fix must reach today's departures.
 */

export const DEFAULT_AGENCY_TIMEZONE = 'Europe/Belgrade';

/**
 * How far ahead departures are stored. The nightly job adds the day that
 * enters the window; booking lead time is at most 88 days on the 22 September
 * restore, and later dates get on-demand departures in PR 3.
 */
export const DEPARTURE_HORIZON_DAYS = 365;

export interface AgencyTimezone {
  timezone: string;
  /** The tenant's own value was set but is not a zone the runtime knows. */
  invalid: boolean;
}

/**
 * The zone a tenant's dates are read in. A typo in the setting must not stop
 * departures from being written, so an unknown zone falls back to the default
 * and is reported by `departure.matchesTimetable` instead.
 */
export function resolveAgencyTimezone(timezone: string | null | undefined): AgencyTimezone {
  const trimmed = timezone?.trim();

  if (!trimmed) {
    return { timezone: DEFAULT_AGENCY_TIMEZONE, invalid: false };
  }

  try {
    new Intl.DateTimeFormat('en-CA', { timeZone: trimmed });
    return { timezone: trimmed, invalid: false };
  } catch {
    return { timezone: DEFAULT_AGENCY_TIMEZONE, invalid: true };
  }
}

/** The agency's local date at `now`, as `YYYY-MM-DD`. */
export function agencyDate(now: Date, timezone: string): string {
  // en-CA formats dates as YYYY-MM-DD.
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(now);
}

export function addDays(date: string, days: number): string {
  const [year, month, day] = date.split('-').map((part) => Number(part));
  const shifted = new Date(Date.UTC(year, month - 1, day + days));

  return shifted.toISOString().slice(0, 10);
}

export interface DepartureWindow {
  from: string;
  to: string;
}

/** From the agency's current date to the end of the horizon, both included. */
export function departureWindow(now: Date, timezone: string): DepartureWindow {
  const from = agencyDate(now, timezone);

  return { from, to: addDays(from, DEPARTURE_HORIZON_DAYS) };
}
