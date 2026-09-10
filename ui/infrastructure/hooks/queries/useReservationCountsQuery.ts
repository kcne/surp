import { useQuery } from "@tanstack/react-query"
import {
  reservationsControllerCounts,
  reservationsControllerCountsResponse,
} from "@/infrastructure/generated/surp-api"

export const reservationCountsQueryKey = (from: string, to: string) =>
  ["reservations", "counts", from, to] as const

function isCountsSuccess(
  response: reservationsControllerCountsResponse
): response is Extract<reservationsControllerCountsResponse, { status: 200 }> {
  return response.status === 200
}

/** Identifies a ride instance the same way the counts endpoint groups them. */
export function rideInstanceCountKey(
  rideId: string,
  date: string,
  departureTime: string
): string {
  return `${rideId}|${date}|${departureTime}`
}

/**
 * Passenger counts for every ride instance in a travel-date window, keyed by
 * ride, date and departure time. One request covers a whole schedule listing,
 * which is why the driver list can show seat usage without opening each ride.
 */
export function useReservationCountsQuery(from: string, to: string) {
  return useQuery({
    queryKey: reservationCountsQueryKey(from, to),
    enabled: Boolean(from) && Boolean(to) && from <= to,
    queryFn: async (): Promise<Map<string, number>> => {
      const response = await reservationsControllerCounts({ from, to })

      if (!isCountsSuccess(response)) {
        throw new Error("Neuspesno ucitavanje broja putnika")
      }

      return new Map(
        response.data.items.map((item) => [
          rideInstanceCountKey(item.rideId, item.travelDate, item.rideDepartureTime),
          item.activeCount,
        ])
      )
    },
    staleTime: 30_000,
  })
}
