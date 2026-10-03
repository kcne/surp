import type { DepartureResponseDto } from "@/infrastructure/generated/model"
import type { Ride, RideInstance } from "@/types"

/**
 * Whether cancelling a ride's timetable bus deletes the whole ride: only the
 * one bus of a one-time ride, with nobody booked on it.
 *
 * Deleting a ride cancels every passenger it has, on any of its buses. So a
 * booked bus is cancelled instead, and its passengers stay on it to be
 * restored or moved, as on any other ride. Any other departure of the ride
 * keeps the ride too, running or cancelled: a cancelled extra's passengers
 * stay on it as well, although it no longer has an ADDITIONAL.
 *
 * `rideDepartures` are the ride's stored departures read just before, not
 * the screen's list, which holds running departures only.
 */
export function cancellingDeletesRide(
  ride: Ride,
  departureId: string,
  rideDepartures: readonly DepartureResponseDto[]
): boolean {
  if (ride.type !== "one-time") {
    return false
  }

  const buses = rideDepartures.filter((departure) => departure.source !== "LEGACY")

  return (
    buses.length === 1 &&
    buses[0].id === departureId &&
    buses[0].activeReservationCount === 0
  )
}

/**
 * Whether a bus is an extra one. Two buses of one ride may leave at the same
 * time since #27 PR 4c, so every screen that offers a bus by its time says
 * which of them is the extra.
 */
export function isExtraBus(instance: Pick<RideInstance, "source">): boolean {
  return instance.source === "ADDITIONAL"
}

/** The words a bus's time is followed by in a list of options. */
export const EXTRA_BUS_SUFFIX = " · dodatni"
