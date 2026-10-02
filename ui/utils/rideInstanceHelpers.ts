import type { Ride } from "@/types"

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
