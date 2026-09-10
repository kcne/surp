import { formatDateToISO, generateRideInstanceDates } from "@/utils/dateHelpers"
import type { Ride, RideException, RideInstance } from "@/types"

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
 * expand the ride template themselves. Instances are built the same way the API
 * builds them: skip exceptions drop a date, additional exceptions override the
 * times, and otherwise the day's station times give the first departure and the
 * last arrival.
 */
export function generateRideInstances(
  ride: Ride,
  options: GenerateRideInstancesOptions = {}
): RideInstance[] {
  const instances: RideInstance[] = []

  if (ride.type === "one-time") {
    if (ride.date && ride.oneTimeDepartureTime && ride.oneTimeArrivalTime) {
      instances.push({
        id: `${ride.id}-${ride.date}`,
        rideId: ride.id,
        ride,
        date: ride.date,
        departureTime: ride.oneTimeDepartureTime,
        arrivalTime: ride.oneTimeArrivalTime,
        status: ride.status,
        reservationCount: 0,
        availableSeats: ride.busCapacity,
      })
    }

    return instances
  }

  if (!ride.startDate || !ride.daysOfWeek || ride.daysOfWeek.length === 0) {
    return instances
  }

  const horizon = options.until ?? defaultHorizon()
  const startDate = new Date(`${ride.startDate}T00:00:00`)
  const endDate = ride.endDate ? new Date(`${ride.endDate}T00:00:00`) : null
  const effectiveEndDate = endDate && endDate < horizon ? endDate : horizon

  const dates = generateRideInstanceDates(startDate, effectiveEndDate, ride.daysOfWeek)

  dates.forEach((date) => {
    const dateString = formatDateToISO(date)
    const exception = ride.exceptions?.find((entry) => entry.date === dateString)

    if (exception?.type === "skip") {
      return
    }

    const { departureTime, arrivalTime } = resolveInstanceTimes(ride, date, exception)

    if (!departureTime || !arrivalTime) {
      return
    }

    instances.push({
      id: `${ride.id}-${dateString}`,
      rideId: ride.id,
      ride,
      date: dateString,
      departureTime,
      arrivalTime,
      status: ride.status,
      reservationCount: 0,
      availableSeats: ride.busCapacity,
    })
  })

  return instances
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
  date: Date,
  exception: RideException | undefined
): { departureTime?: string; arrivalTime?: string } {
  if (exception?.type === "additional") {
    return { departureTime: exception.departureTime, arrivalTime: exception.arrivalTime }
  }

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
