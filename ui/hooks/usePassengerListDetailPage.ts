import { useMemo } from "react"
import { useQuery } from "@tanstack/react-query"
import { useSearchParams } from "next/navigation"
import { useRidesListQuery } from "@/infrastructure/hooks/queries/useRidesListQuery"
import { useDepartureQuery } from "@/infrastructure/hooks/queries/useDeparturesQuery"
import { toDepartureInstance } from "@/infrastructure/mappers/departureMappers"
import { useLegacyDepartureRedirect } from "@/hooks/useLegacyDepartureRedirect"
import { parseLegacyPassengerListLink } from "@/utils/legacyDepartureLinks"
import { useReservationsByRideInstanceQuery } from "@/infrastructure/hooks/queries/useReservationsByRideInstanceQuery"
import {
  buildPassengerListHeading,
  buildPassengerListRows,
  formatWeekday,
  selectRideInstancePassengers,
} from "@/utils/passengerListHelpers"
import type { PassengerListRow } from "@/utils/passengerListHelpers"

interface UsePassengerListDetailPageParams {
  /** The departure's ID, or the ride's in a link made before PR 4a. */
  departureId: string
}

const EMPTY_ROWS: PassengerListRow[] = []

/**
 * Loads one departure and the passenger list a driver reads on the bus. The
 * page is keyed by departureId (#27, PR 4a); an old link that named the ride
 * with a date and departure time is replaced with the departure it meant.
 */
export function usePassengerListDetailPage({ departureId }: UsePassengerListDetailPageParams) {
  const searchParams = useSearchParams()
  const legacyLink = useMemo(
    () =>
      parseLegacyPassengerListLink(
        departureId,
        searchParams?.get("date"),
        searchParams?.get("departure")
      ),
    [departureId, searchParams]
  )
  const legacyRedirect = useLegacyDepartureRedirect(
    legacyLink,
    (resolvedId) => `/passenger-lists/${encodeURIComponent(resolvedId)}`
  )

  const ridesQuery = useRidesListQuery()
  const rides = useMemo(() => ridesQuery.data ?? [], [ridesQuery.data])
  const departureQuery = useDepartureQuery(legacyLink ? null : departureId)

  const rideInstance = useMemo(() => {
    if (!departureQuery.data) {
      return null
    }

    return toDepartureInstance(
      departureQuery.data,
      rides.find((ride) => ride.id === departureQuery.data?.rideId)
    )
  }, [departureQuery.data, rides])

  const reservationsQuery = useReservationsByRideInstanceQuery(rideInstance)
  const reservations = useMemo(() => reservationsQuery.data ?? [], [reservationsQuery.data])

  const passengers = useMemo(
    () => (rideInstance ? selectRideInstancePassengers(reservations, rideInstance) : []),
    [reservations, rideInstance]
  )

  // The INFO column resolves each passenger's return leg over the network, so
  // the rows are a query of their own rather than a render-time computation.
  const rowsQuery = useQuery({
    queryKey: [
      "passenger-list",
      "rows",
      rideInstance?.id ?? "none",
      passengers.map((passenger) => passenger.id).join(","),
    ],
    // Waiting for the reservations keeps an empty list from being cached and
    // rendered as "no reservations" before they arrive.
    enabled: Boolean(rideInstance) && reservationsQuery.isSuccess,
    queryFn: async (): Promise<PassengerListRow[]> => {
      if (!rideInstance) {
        return EMPTY_ROWS
      }

      return buildPassengerListRows(rideInstance, passengers)
    },
    staleTime: 30_000,
  })

  const heading = rideInstance
    ? buildPassengerListHeading(rideInstance, passengers.length)
    : ""

  return {
    rideInstance,
    rows: rowsQuery.data ?? EMPTY_ROWS,
    heading,
    weekday: rideInstance ? formatWeekday(rideInstance.date) : "",
    passengerCount: passengers.length,
    capacity: rideInstance?.ride.busCapacity ?? 0,
    freeSeats: rideInstance
      ? Math.max(rideInstance.ride.busCapacity - passengers.length, 0)
      : 0,
    isLoading:
      ridesQuery.isLoading ||
      departureQuery.isLoading ||
      legacyRedirect.resolving ||
      reservationsQuery.isLoading,
    isRowsLoading: !reservationsQuery.isSuccess || rowsQuery.isLoading || rowsQuery.isFetching,
    isNotFound:
      legacyRedirect.notFound ||
      departureQuery.isError ||
      (!legacyLink && departureQuery.isSuccess && departureQuery.data === null),
  }
}
