import { formatDateToISO, generateRideInstanceDates } from "@/utils/dateHelpers"
import type { Ride, RideInstance } from "@/types"

/** How far ahead a recurring ride is materialized when no end date caps it. */
const DEFAULT_HORIZON_MONTHS = 3

interface GenerateRideInstancesOptions {
  /** Latest date to materialize; defaults to three months from today. */
  until?: Date
}

/**
 * Materializes the instances of a single ride on the client.
 *
 * The API serves instances one date at a time, which is fine for a seat map but
 * far too many round trips for a list spanning months, so the schedule views
 * expand the ride template themselves. A SKIP removes only the timetable
 * bus; every ADDITIONAL remains a separate bus, including on unscheduled dates.
 */
export function generateRideInstances(
  ride: Ride,
  options: GenerateRideInstancesOptions = {}
): RideInstance[] {
  const horizon = options.until ?? defaultHorizon()
  const baseDates = new Set<string>()

  if (ride.type === "one-time") {
    if (ride.date) baseDates.add(ride.date)
  } else if (ride.startDate && ride.daysOfWeek?.length) {
    const startDate = new Date(`${ride.startDate}T00:00:00`)
    const endDate = ride.endDate ? new Date(`${ride.endDate}T00:00:00`) : null
    const effectiveEndDate = endDate && endDate < horizon ? endDate : horizon
    for (const date of generateRideInstanceDates(startDate, effectiveEndDate, ride.daysOfWeek)) {
      baseDates.add(formatDateToISO(date))
    }
  }

  const dates = new Set(baseDates)
  for (const exception of ride.exceptions ?? []) {
    if (exception.type === "additional" && exception.date <= formatDateToISO(horizon)) {
      dates.add(exception.date)
    }
  }

  const instances: RideInstance[] = []
  const append = (
    date: string,
    source: "BASE" | "ADDITIONAL",
    departureTime?: string,
    arrivalTime?: string,
    capacity = ride.busCapacity
  ) => {
    if (!departureTime || !arrivalTime) return
    instances.push({
      // Match /rides/instances IDs so selectors and seat-map links name the
      // same bus, and several buses on one date have distinct identities.
      id: `${ride.id}:${date}:${departureTime}:${source}`,
      source,
      rideId: ride.id,
      // An extra bus can have its own capacity; the screens read seats from
      // the instance's ride, as with instances from /rides/instances.
      ride: capacity === ride.busCapacity ? ride : { ...ride, busCapacity: capacity },
      date,
      departureTime,
      arrivalTime,
      status: ride.status,
      reservationCount: 0,
      availableSeats: capacity,
    })
  }

  for (const date of [...dates].sort()) {
    const exceptions = (ride.exceptions ?? []).filter((entry) => entry.date === date)
    if (baseDates.has(date) && !exceptions.some((entry) => entry.type === "skip")) {
      const times = ride.type === "one-time"
        ? { departureTime: ride.oneTimeDepartureTime, arrivalTime: ride.oneTimeArrivalTime }
        : resolveInstanceTimes(ride, new Date(`${date}T00:00:00`))
      append(date, "BASE", times.departureTime, times.arrivalTime)
    }
    for (const extra of exceptions.filter((entry) => entry.type === "additional")) {
      append(date, "ADDITIONAL", extra.departureTime, extra.arrivalTime, extra.capacity)
    }
  }

  return instances.sort((left, right) =>
    left.date.localeCompare(right.date) || left.departureTime.localeCompare(right.departureTime)
  )
}

/**
 * Whether cancelling a ride's timetable bus deletes the whole ride. Only a
 * one-time ride with no extra bus: deleting one that has extras would cancel
 * the extras and their passengers too, so its date is skipped instead.
 */
export function cancellingDeletesRide(ride: Ride): boolean {
  return (
    ride.type === "one-time" &&
    !(ride.exceptions ?? []).some((exception) => exception.type === "additional")
  )
}

interface UpcomingRideInstancesOptions extends GenerateRideInstancesOptions {
  /** Earliest date to keep, inclusive; defaults to today. */
  from?: string
}

/**
 * Materializes every scheduled ride into instances from `from` onwards, sorted
 * by date and then departure time so the nearest departure leads the list.
 */
export function generateUpcomingRideInstances(
  rides: Ride[],
  options: UpcomingRideInstancesOptions = {}
): RideInstance[] {
  const from = options.from ?? formatDateToISO(new Date())

  return rides
    .filter((ride) => ride.status === "scheduled")
    .flatMap((ride) => generateRideInstances(ride, options))
    .filter((instance) => instance.date >= from)
    .sort(
      (left, right) =>
        left.date.localeCompare(right.date) ||
        left.departureTime.localeCompare(right.departureTime) ||
        left.ride.line.name.localeCompare(right.ride.line.name)
    )
}

function defaultHorizon(): Date {
  const horizon = new Date()
  horizon.setMonth(horizon.getMonth() + DEFAULT_HORIZON_MONTHS)
  return horizon
}

function resolveInstanceTimes(
  ride: Ride,
  date: Date
): { departureTime?: string; arrivalTime?: string } {
  const daySchedule = ride.daySchedules?.[date.getDay()]
  if (daySchedule && daySchedule.length > 0) {
    const stationTimes = [...daySchedule].sort(
      (left, right) => left.orderIndex - right.orderIndex
    )
    return {
      departureTime: stationTimes[0]?.time,
      arrivalTime: stationTimes[stationTimes.length - 1]?.time,
    }
  }

  return { departureTime: ride.departureTime, arrivalTime: ride.arrivalTime }
}
