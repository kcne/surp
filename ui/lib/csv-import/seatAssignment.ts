import type { ImportRow } from "./types"

export interface SeatAssignmentContext {
  /** Seats already booked in the system, keyed by ride instance id. */
  bookedSeatsByRideInstanceId: Record<string, number[]>
  capacityByRideInstanceId: Record<string, number>
}

/**
 * Fills every auto-assigned seat with the lowest free number on its ride,
 * treating operator-chosen seats and already-booked seats as taken. Rows that
 * cannot get a seat (ride full, or no ride yet) keep `null` and fail validation.
 */
export function assignSeats(
  rows: ImportRow[],
  { bookedSeatsByRideInstanceId, capacityByRideInstanceId }: SeatAssignmentContext
): ImportRow[] {
  const takenByRideInstanceId = new Map<string, Set<number>>()

  const takenFor = (rideInstanceId: string): Set<number> => {
    const existing = takenByRideInstanceId.get(rideInstanceId)
    if (existing) {
      return existing
    }

    const seats = new Set(bookedSeatsByRideInstanceId[rideInstanceId] ?? [])
    takenByRideInstanceId.set(rideInstanceId, seats)
    return seats
  }

  // Manual seats are reserved first so an auto-assignment never steals one.
  rows.forEach((row) => {
    if (row.excluded || !row.rideInstanceId || row.seatIsAutoAssigned || row.seatNumber === null) {
      return
    }

    takenFor(row.rideInstanceId).add(row.seatNumber)
  })

  return rows.map((row) => {
    if (row.excluded || !row.seatIsAutoAssigned) {
      return row
    }

    if (!row.rideInstanceId) {
      return row.seatNumber === null ? row : { ...row, seatNumber: null }
    }

    const taken = takenFor(row.rideInstanceId)
    const capacity = capacityByRideInstanceId[row.rideInstanceId] ?? 0

    let seatNumber: number | null = null
    for (let candidate = 1; candidate <= capacity; candidate += 1) {
      if (!taken.has(candidate)) {
        seatNumber = candidate
        break
      }
    }

    if (seatNumber !== null) {
      taken.add(seatNumber)
    }

    return row.seatNumber === seatNumber ? row : { ...row, seatNumber }
  })
}
