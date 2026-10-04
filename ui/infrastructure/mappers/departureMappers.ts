import type { DepartureResponseDto } from "@/infrastructure/generated/model"
import type { Line, Ride, RideInstance } from "@/types"

/**
 * Whether a stored departure is a bus people can still travel on: not
 * cancelled by an operator, not dropped by the timetable, and not a LEGACY
 * record of past reservations.
 */
export function isRunningDeparture(departure: DepartureResponseDto): boolean {
  return (
    departure.source !== "LEGACY" &&
    departure.cancelledAt === null &&
    departure.timetableDroppedAt === null
  )
}

/**
 * The route a departure stores, as a line, for a departure whose ride is not
 * loaded or has since moved to another line.
 */
function lineFromStops(departure: DepartureResponseDto): Line {
  const stops = [...departure.stops].sort((left, right) => left.orderIndex - right.orderIndex)
  const first = stops[0]
  const last = stops[stops.length - 1]

  return {
    id: departure.lineId,
    name: departure.lineName,
    departureStation: { id: first?.stationId ?? "", name: first?.stationName ?? "", address: "" },
    arrivalStation: { id: last?.stationId ?? "", name: last?.stationName ?? "", address: "" },
    intermediateStations: stops.slice(1, -1).map((stop, index) => ({
      stationId: stop.stationId,
      stationName: stop.stationName,
      order: index + 1,
      isBoarding: stop.isBoarding,
      isDropoff: stop.isDropoff,
    })),
    isActive: true,
  }
}

/**
 * One stored departure as the bus the screens show and book (#27, PR 4a). Its
 * ID is the departure's, so seat-map links, selectors and reservations all
 * name the same bus. Seats are the departure's own capacity.
 */
export function toDepartureInstance(departure: DepartureResponseDto, ride?: Ride): RideInstance {
  const sameLine = ride && ride.line.id === departure.lineId
  const baseRide: Ride = ride
    ? { ...ride, line: sameLine ? ride.line : lineFromStops(departure) }
    : {
        id: departure.rideId,
        name: departure.rideName,
        line: lineFromStops(departure),
        busCapacity: departure.capacity,
        type: "recurring",
        status: "scheduled",
        daySchedules: {},
        exceptions: [],
      }

  return {
    id: departure.id,
    departureId: departure.id,
    source: departure.source === "EXTRA" ? "ADDITIONAL" : "BASE",
    rideId: departure.rideId,
    ride: { ...baseRide, busCapacity: departure.capacity },
    date: departure.serviceDate,
    departureTime: departure.departureTime,
    arrivalTime: departure.arrivalTime,
    status: isRunningDeparture(departure) ? "scheduled" : "cancelled",
    reservationCount: departure.activeReservationCount,
    availableSeats: departure.availableSeats,
  }
}

/** Running departures as instances, nearest first, then by line name. */
export function toRunningDepartureInstances(
  departures: readonly DepartureResponseDto[],
  rides: readonly Ride[]
): RideInstance[] {
  const rideById = new Map(rides.map((ride) => [ride.id, ride]))

  return departures
    .filter(isRunningDeparture)
    .map((departure) => toDepartureInstance(departure, rideById.get(departure.rideId)))
    .sort(
      (left, right) =>
        left.date.localeCompare(right.date) ||
        left.departureTime.localeCompare(right.departureTime) ||
        left.ride.line.name.localeCompare(right.ride.line.name)
    )
}
