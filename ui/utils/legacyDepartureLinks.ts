import type { DepartureResponseDto } from "@/infrastructure/generated/model"

/**
 * Links made before PR 4a named a bus by its ride, date and time: a seat map
 * at `/reservations/<rideId>:<date>:<time>:<source>`, a passenger list at
 * `/passenger-lists/<rideId>?date=<date>&departure=<time>`. They are resolved
 * once to the departure they meant and replaced. Removed in PR 6.
 */
export interface LegacyDepartureLink {
  rideId: string
  date: string
  departureTime: string
}

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/
const TIME_PATTERN = /^\d{2}:\d{2}$/

/** The ride, date and time an old seat-map ID names, or null for a departure ID. */
export function parseLegacyInstanceId(value: string): LegacyDepartureLink | null {
  // A time has its own colon: `<rideId>:<date>:<HH>:<mm>[:<source>]`.
  const [rideId, date, hours, minutes] = value.split(":")
  const departureTime = `${hours}:${minutes}`

  if (!rideId || !DATE_PATTERN.test(date ?? "") || !TIME_PATTERN.test(departureTime)) {
    return null
  }

  return { rideId, date, departureTime }
}

/** The ride, date and time an old passenger-list link names, or null for a new one. */
export function parseLegacyPassengerListLink(
  rideId: string,
  date: string | null | undefined,
  departureTime: string | null | undefined
): LegacyDepartureLink | null {
  if (!rideId || !date || !departureTime) {
    return null
  }

  if (!DATE_PATTERN.test(date) || !TIME_PATTERN.test(departureTime)) {
    return null
  }

  return { rideId, date, departureTime }
}

/**
 * The one departure an old link meant: the ride's bus that day at that time.
 * Null when there is none, or more than one, since guessing could open the
 * wrong bus's passengers.
 */
export function resolveLegacyDeparture(
  departures: readonly DepartureResponseDto[],
  link: LegacyDepartureLink
): string | null {
  const matches = departures.filter(
    (departure) =>
      departure.rideId === link.rideId &&
      departure.serviceDate === link.date &&
      departure.departureTime === link.departureTime
  )

  return matches.length === 1 ? matches[0].id : null
}
