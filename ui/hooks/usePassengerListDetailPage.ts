import { useMemo } from "react"
import { useQuery } from "@tanstack/react-query"
import { useSearchParams } from "next/navigation"
import { useRidesListQuery } from "@/infrastructure/hooks/queries/useRidesListQuery"
import { useRidesInstancesByDateQuery } from "@/infrastructure/hooks/queries/useRidesInstancesByDateQuery"
import { useReservationsByRideInstanceQuery } from "@/infrastructure/hooks/queries/useReservationsByRideInstanceQuery"
import {
  buildPassengerListHeading,
  buildPassengerListRows,
  formatWeekday,
  selectRideInstancePassengers,
} from "@/utils/passengerListHelpers"
import type { PassengerListRow } from "@/utils/passengerListHelpers"

interface UsePassengerListDetailPageParams {
  rideId: string
}

const EMPTY_ROWS: PassengerListRow[] = []

/**
 * Loads one ride instance and the passenger list a driver reads on the bus.
 *
 * The overview links here with the ride id plus the date and departure time
 * rather than a materialized instance id, because that overview expands the
 * schedule on the client and never sees the ids the API assigns; resolving the
 * instance is one request for the linked date.
 */
export function usePassengerListDetailPage({ rideId }: UsePassengerListDetailPageParams) {
  const searchParams = useSearchParams()
  const dateParam = searchParams?.get("date") ?? ""
  const departureParam = searchParams?.get("departure") ?? ""

  const selectedDate = useMemo(() => {
    if (!dateParam) {
      return undefined
    }

    const parsed = new Date(`${dateParam}T00:00:00`)
    return Number.isNaN(parsed.getTime()) ? undefined : parsed
  }, [dateParam])

  const ridesQuery = useRidesListQuery()
  const rides = useMemo(() => ridesQuery.data ?? [], [ridesQuery.data])
  const rideInstancesQuery = useRidesInstancesByDateQuery(selectedDate, rides)

  const rideInstance = useMemo(() => {
    const instances = rideInstancesQuery.data ?? []
    const forRide = instances.filter((instance) => instance.rideId === rideId)

    if (!departureParam) {
      return forRide[0] ?? null
    }

    return forRide.find((instance) => instance.departureTime === departureParam) ?? null
  }, [rideInstancesQuery.data, rideId, departureParam])

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
      ridesQuery.isLoading || rideInstancesQuery.isLoading || reservationsQuery.isLoading,
    isRowsLoading: !reservationsQuery.isSuccess || rowsQuery.isLoading || rowsQuery.isFetching,
    // A missing or unparsable date leaves nothing to resolve the instance from,
    // so it is reported the same way as a date that no longer has this ride.
    isNotFound:
      !selectedDate ||
      (!rideInstance &&
        !ridesQuery.isLoading &&
        !rideInstancesQuery.isLoading &&
        rideInstancesQuery.isFetched),
  }
}
