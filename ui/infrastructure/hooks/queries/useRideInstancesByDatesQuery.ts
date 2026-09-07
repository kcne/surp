import { useMemo } from "react"
import { useQueries } from "@tanstack/react-query"
import {
  ridesControllerListInstancesByDate,
  ridesControllerListInstancesByDateResponse,
} from "@/infrastructure/generated/surp-api"
import { toRideInstance } from "@/infrastructure/mappers/rideMappers"
import type { Ride, RideInstance } from "@/types"

export const rideInstancesByDateQueryKey = (dateIso: string, ridesSignature: string) =>
  ["rides", "instances", dateIso, ridesSignature] as const

function isSuccess(
  response: ridesControllerListInstancesByDateResponse
): response is Extract<ridesControllerListInstancesByDateResponse, { status: 200 }> {
  return response.status === 200
}

/**
 * A CSV import spans many travel dates, so instances are fetched per distinct
 * date and flattened into one lookup keyed by ISO date.
 */
export function useRideInstancesByDatesQuery(dates: string[], rides: Ride[]) {
  const uniqueDates = useMemo(
    () => Array.from(new Set(dates.filter((date) => date.length > 0))).sort(),
    [dates]
  )

  const ridesSignature = useMemo(
    () => rides.map((ride) => `${ride.id}:${ride.updatedAt ?? ""}`).join("|"),
    [rides]
  )

  const rideLookup = useMemo(() => new Map(rides.map((ride) => [ride.id, ride])), [rides])

  // Combined inside `useQueries` rather than in a `useMemo` over its return
  // value: that array is rebuilt on every render, so a memo keyed on it would
  // hand out a new lookup each time and re-run every consumer's effects.
  // `combine` results are structurally shared, so the identity holds while the
  // underlying data does.
  return useQueries({
    queries: uniqueDates.map((dateIso) => ({
      queryKey: rideInstancesByDateQueryKey(dateIso, ridesSignature),
      enabled: rides.length > 0,
      staleTime: 60_000,
      queryFn: async (): Promise<RideInstance[]> => {
        const response = await ridesControllerListInstancesByDate({ date: dateIso })

        if (!isSuccess(response)) {
          throw new Error("Neuspesno ucitavanje instanci voznji")
        }

        return response.data.items.map((instance) =>
          toRideInstance(instance, rideLookup.get(instance.rideId))
        )
      },
    })),
    combine: (results) => {
      const rideInstancesByDate: Record<string, RideInstance[]> = {}
      const rideInstancesById: Record<string, RideInstance> = {}

      uniqueDates.forEach((dateIso, index) => {
        const instances = results[index]?.data ?? []
        rideInstancesByDate[dateIso] = instances

        instances.forEach((instance) => {
          rideInstancesById[instance.id] = instance
        })
      })

      return {
        rideInstancesByDate,
        rideInstancesById,
        isLoading: results.some((result) => result.isLoading),
        isFetching: results.some((result) => result.isFetching),
      }
    },
  })
}
