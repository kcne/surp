import { useCallback, useMemo } from "react"
import { useQueries, useQuery, useQueryClient } from "@tanstack/react-query"
import {
  departuresControllerGetById,
  departuresControllerList,
} from "@/infrastructure/generated/surp-api"
import type { DepartureResponseDto } from "@/infrastructure/generated/model"
import { toRunningDepartureInstances } from "@/infrastructure/mappers/departureMappers"
import { splitIntoDepartureWindows, type DateWindow } from "@/utils/departureWindows"
import type { Ride, RideInstance } from "@/types"

/**
 * Stored departures (#27, PR 4a): the buses the screens show, read from
 * GET /departures instead of being rebuilt from the timetable on the client.
 * Every key starts with "departures", so a booking or a timetable edit
 * refreshes them all at once.
 */
export const departuresQueryKey = ["departures"] as const

export interface DepartureFilter {
  rideId?: string
  lineId?: string
}

export const departureWindowQueryKey = (window: DateWindow, filter: DepartureFilter = {}) =>
  ["departures", "window", window.from, window.to, filter.rideId ?? "", filter.lineId ?? ""] as const

export const departureQueryKey = (id: string) => ["departures", "one", id] as const

export const cancelledDeparturesQueryKey = (window: DateWindow) =>
  ["departures", "cancelled", window.from, window.to] as const

export async function fetchDepartureWindow(
  window: DateWindow,
  filter: DepartureFilter = {}
): Promise<DepartureResponseDto[]> {
  const response = await departuresControllerList({
    from: window.from,
    to: window.to,
    ...(filter.rideId ? { rideId: filter.rideId } : {}),
    ...(filter.lineId ? { lineId: filter.lineId } : {}),
  })

  if (response.status !== 200) {
    throw new Error("Neuspesno ucitavanje polazaka")
  }

  return response.data.items
}

interface DepartureRangeOptions extends DepartureFilter {
  enabled?: boolean
}

/**
 * Every stored departure in a range, fetched in windows of at most 62 days.
 * Each window is cached on its own, so a range that grows keeps what it
 * already has.
 */
export function useDepartureRangeQuery(range: DateWindow, options: DepartureRangeOptions = {}) {
  const { rideId, lineId, enabled = true } = options
  const { from, to } = range
  const queryClient = useQueryClient()
  const windows = useMemo(() => splitIntoDepartureWindows({ from, to }), [from, to])

  const combined = useQueries({
    queries: windows.map((window) => ({
      queryKey: departureWindowQueryKey(window, { rideId, lineId }),
      queryFn: () => fetchDepartureWindow(window, { rideId, lineId }),
      enabled,
      staleTime: 60_000,
    })),
    combine: (results) => ({
      departures: results.flatMap((result) => result.data ?? []),
      isLoading: results.some((result) => result.isLoading),
      isFetching: results.some((result) => result.isFetching),
      isError: results.some((result) => result.isError),
    }),
  })

  // Every window of the range again, for a retry after a failed one.
  const refetch = useCallback(
    () =>
      Promise.all(
        windows.map((window) =>
          queryClient.refetchQueries({
            queryKey: departureWindowQueryKey(window, { rideId, lineId }),
            exact: true,
          })
        )
      ).then(() => undefined),
    [queryClient, windows, rideId, lineId]
  )

  return { ...combined, refetch }
}

/**
 * The running departures in a range as instances, joined to their rides so
 * the screens keep the line's stations and the ride's type.
 */
export function useRunningDeparturesQuery(
  range: DateWindow,
  rides: readonly Ride[],
  options: DepartureRangeOptions = {}
) {
  const query = useDepartureRangeQuery(range, options)
  const instances = useMemo<RideInstance[]>(
    () => toRunningDepartureInstances(query.departures, rides),
    [query.departures, rides]
  )

  return { ...query, instances }
}

/**
 * The departures an operator cancelled in a range of up to 366 days, in one
 * request (#27, PR 4c). The API filters them, so the size follows how many
 * buses were cancelled, not the timetable.
 */
export function useCancelledDeparturesQuery(window: DateWindow) {
  return useQuery({
    queryKey: cancelledDeparturesQueryKey(window),
    staleTime: 60_000,
    queryFn: async (): Promise<DepartureResponseDto[]> => {
      const response = await departuresControllerList({
        from: window.from,
        to: window.to,
        cancelled: "true",
      })

      if (response.status !== 200) {
        throw new Error("Neuspesno ucitavanje otkazanih polazaka")
      }

      return response.data.items
    },
  })
}

/** One stored departure, or null when the tenant has none with this ID. */
export function useDepartureQuery(id: string | null) {
  return useQuery({
    queryKey: departureQueryKey(id ?? "none"),
    enabled: Boolean(id),
    staleTime: 60_000,
    queryFn: async (): Promise<DepartureResponseDto | null> => {
      if (!id) {
        return null
      }

      const response = await departuresControllerGetById(id)

      if (response.status === 404) {
        return null
      }

      if (response.status !== 200) {
        throw new Error("Neuspesno ucitavanje polaska")
      }

      return response.data
    },
  })
}
