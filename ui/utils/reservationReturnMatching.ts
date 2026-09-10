import type { Reservation, RideInstance } from "@/types"

export interface ReturnCounterpart {
  reservation: Reservation
  rideInstance: RideInstance
}

/**
 * Finds the return-leg reservation that belongs to an outbound one.
 *
 * Return legs are not linked in the database, so they are recognized by the
 * mirrored station pair on a ride instance of the opposite direction. When a
 * passenger has several such legs, the one on the same seat and the earliest
 * departure wins.
 */
export function findReturnCounterpart(
  reservation: Reservation,
  returnRideInstances: RideInstance[],
  reservationsByRideInstanceId: Record<string, Reservation[]>
): ReturnCounterpart | null {
  const returnInstanceById = new Map(
    returnRideInstances.map((instance) => [instance.id, instance])
  )

  const matched = Object.entries(reservationsByRideInstanceId)
    .flatMap(([instanceId, reservationsForInstance]) =>
      returnInstanceById.has(instanceId) ? reservationsForInstance : []
    )
    .filter((candidate) => {
      if (candidate.status !== "active") return false
      if (candidate.passengerId !== reservation.passengerId) return false
      if (candidate.departureStationId !== reservation.arrivalStationId) return false
      if (candidate.arrivalStationId !== reservation.departureStationId) return false
      return true
    })
    .sort((left, right) => {
      const leftSeatScore = left.seatNumber === reservation.seatNumber ? 0 : 1
      const rightSeatScore = right.seatNumber === reservation.seatNumber ? 0 : 1
      if (leftSeatScore !== rightSeatScore) {
        return leftSeatScore - rightSeatScore
      }

      const leftInstance = returnInstanceById.get(left.rideInstanceId)
      const rightInstance = returnInstanceById.get(right.rideInstanceId)

      const leftDateTime = leftInstance ? `${leftInstance.date}T${leftInstance.departureTime}` : ""
      const rightDateTime = rightInstance
        ? `${rightInstance.date}T${rightInstance.departureTime}`
        : ""

      return leftDateTime.localeCompare(rightDateTime)
    })[0]

  if (!matched) {
    return null
  }

  const matchedInstance = returnInstanceById.get(matched.rideInstanceId)
  if (!matchedInstance) {
    return null
  }

  return { reservation: matched, rideInstance: matchedInstance }
}
