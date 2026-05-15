import { useMemo } from "react"
import { useQueries, useQuery } from "@tanstack/react-query"
import {
  reservationsControllerList,
  reservationsControllerListResponse,
} from "@/infrastructure/generated/surp-api"
import { toReservation } from "@/infrastructure/mappers/reservationMappers"
import type { Reservation, RideInstance } from "@/types"

export const reservationsByRideInstanceQueryKey = (rideInstanceId: string) =>
  ["reservations", "ride-instance", rideInstanceId] as const
const MAX_PAGE_SIZE = 100

function isReservationsListSuccess(
  response: reservationsControllerListResponse
): response is Extract<reservationsControllerListResponse, { status: 200 }> {
  return response.status === 200
}

async function fetchReservationsForRideInstance(
  rideInstance: RideInstance
): Promise<Reservation[]> {
  let currentPage = 1
  let total = 0
  const items: Reservation[] = []

  do {
    const response = await reservationsControllerList({
      page: currentPage,
      pageSize: MAX_PAGE_SIZE,
      rideId: rideInstance.rideId,
      travelDate: rideInstance.date,
      rideDepartureTime: rideInstance.departureTime,
    })

    if (!isReservationsListSuccess(response)) {
      throw new Error("Neuspesno ucitavanje rezervacija")
    }

    total = response.data.total
    items.push(...response.data.items.map((item) => toReservation(item, rideInstance)))
    currentPage += 1
  } while (items.length < total)

  return items
}

export function useReservationsByRideInstanceQuery(
  rideInstance: RideInstance | null,
  options?: { enabled?: boolean }
) {
  return useQuery({
    queryKey: reservationsByRideInstanceQueryKey(rideInstance?.id ?? "none"),
    enabled: Boolean(rideInstance) && (options?.enabled ?? true),
    queryFn: async (): Promise<Reservation[]> => {
      if (!rideInstance) {
        return []
      }

      return fetchReservationsForRideInstance(rideInstance)
    },
    staleTime: 30_000,
  })
}

export function useReservationsByRideInstancesQuery(
  rideInstances: RideInstance[],
  options?: { enabled?: boolean }
) {
  const enabled = options?.enabled ?? true
  const queries = useQueries({
    queries: rideInstances.map((rideInstance) => ({
      queryKey: reservationsByRideInstanceQueryKey(rideInstance.id),
      queryFn: async () => fetchReservationsForRideInstance(rideInstance),
      staleTime: 30_000,
      enabled,
    })),
  })

  const reservationsByRideInstanceId = useMemo(() => {
    const mapped: Record<string, Reservation[]> = {}

    rideInstances.forEach((rideInstance, index) => {
      mapped[rideInstance.id] = queries[index]?.data ?? []
    })

    return mapped
  }, [queries, rideInstances])

  const isLoading = queries.some((query) => query.isLoading)

  return {
    reservationsByRideInstanceId,
    isLoading,
  }
}
