import type { RideInstance } from "@/types"

/** Station ids along a line, in travel order. */
export function getRouteStationIds(rideInstance: RideInstance): string[] {
  const { line } = rideInstance.ride

  const intermediateIds = [...line.intermediateStations]
    .sort((left, right) => left.order - right.order)
    .map((station) => station.stationId)

  return [line.departureStation.id, ...intermediateIds, line.arrivalStation.id]
}

/**
 * A ride serves a row only if both stations sit on its route and the arrival
 * comes after the departure, so the reversed direction is never matched.
 */
export function rideInstanceServesSegment(
  rideInstance: RideInstance,
  departureStationId: string,
  arrivalStationId: string
): boolean {
  const route = getRouteStationIds(rideInstance)
  const departureIndex = route.indexOf(departureStationId)
  const arrivalIndex = route.indexOf(arrivalStationId)

  return departureIndex !== -1 && arrivalIndex !== -1 && arrivalIndex > departureIndex
}

export interface RideInstanceResolution {
  candidateIds: string[]
  /** Set only when exactly one candidate exists, so auto-fill stays unambiguous. */
  resolvedId: string | null
}

export function resolveRideInstance(
  rideInstancesForDate: RideInstance[],
  departureStationId: string | null,
  arrivalStationId: string | null
): RideInstanceResolution {
  if (!departureStationId || !arrivalStationId) {
    return { candidateIds: [], resolvedId: null }
  }

  const candidates = rideInstancesForDate
    .filter((rideInstance) => rideInstance.status !== "cancelled")
    .filter((rideInstance) =>
      rideInstanceServesSegment(rideInstance, departureStationId, arrivalStationId)
    )
    .sort((left, right) => left.departureTime.localeCompare(right.departureTime))

  return {
    candidateIds: candidates.map((rideInstance) => rideInstance.id),
    resolvedId: candidates.length === 1 ? candidates[0].id : null,
  }
}
