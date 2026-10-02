import { useCallback, useMemo } from "react"
import { useQueries, useQueryClient } from "@tanstack/react-query"
import {
  departureWindowQueryKey,
  fetchDepartureWindow,
} from "@/infrastructure/hooks/queries/useDeparturesQuery"
import { toRunningDepartureInstances } from "@/infrastructure/mappers/departureMappers"
import { windowsCoveringDates } from "@/utils/departureWindows"
import type { Ride, RideInstance } from "@/types"

/**
 * A CSV import spans many travel dates, so the running departures covering
 * them (#27, PR 4a) are fetched in as few windows as reach every date, and
 * flattened into lookups by ISO date and by departure ID.
 */
export function useRideInstancesByDatesQuery(dates: string[], rides: Ride[]) {
  const queryClient = useQueryClient()
  const windows = useMemo(() => windowsCoveringDates(dates), [dates])

  const query = useQueries({
    queries: windows.map((window) => ({
      queryKey: departureWindowQueryKey(window),
      queryFn: () => fetchDepartureWindow(window),
      enabled: rides.length > 0,
      staleTime: 60_000,
    })),
    combine: (results) => ({
      departures: results.flatMap((result) => result.data ?? []),
      isLoading: results.some((result) => result.isLoading),
      isFetching: results.some((result) => result.isFetching),
      isError: results.some((result) => result.isError),
    }),
  })

  // A failed window leaves its dates without buses, which must not read as
  // "no departure": the page reports it and retries every window.
  const refetch = useCallback(
    () =>
      Promise.all(
        windows.map((window) =>
          queryClient.refetchQueries({ queryKey: departureWindowQueryKey(window), exact: true })
        )
      ).then(() => undefined),
    [queryClient, windows]
  )

  const lookups = useMemo(() => {
    const rideInstancesByDate: Record<string, RideInstance[]> = {}
    const rideInstancesById: Record<string, RideInstance> = {}

    for (const date of dates) {
      if (date) rideInstancesByDate[date] = []
    }

    for (const instance of toRunningDepartureInstances(query.departures, rides)) {
      ;(rideInstancesByDate[instance.date] ??= []).push(instance)
      rideInstancesById[instance.id] = instance
    }

    return { rideInstancesByDate, rideInstancesById }
  }, [dates, query.departures, rides])

  return {
    ...lookups,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    isError: query.isError,
    refetch,
  }
}
