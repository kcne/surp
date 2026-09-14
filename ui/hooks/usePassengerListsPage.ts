import { useMemo, useState } from "react"
import { useRidesListQuery } from "@/infrastructure/hooks/queries/useRidesListQuery"
import {
  rideInstanceCountKey,
  useReservationCountsQuery,
} from "@/infrastructure/hooks/queries/useReservationCountsQuery"
import { formatDateToISO } from "@/utils/dateHelpers"
import { generateUpcomingRideInstances } from "@/utils/rideInstanceHelpers"
import type { Ride, RideInstance } from "@/types"

export const ALL_RIDES_OPTION = "all"

export interface UpcomingRideListItem {
  rideInstance: RideInstance
  /** Active reservations already booked on that instance. */
  passengerCount: number
  capacity: number
}

const EMPTY_RIDES: Ride[] = []

export interface RideFilterOption {
  value: string
  label: string
}

/**
 * Drives the driver-facing passenger list overview: every upcoming ride in the
 * schedule on a selected day and how full each departure is.
 *
 * Instances are expanded from the ride templates on the client — the API serves
 * them one date at a time. Passenger counts come from a single grouped count
 * for the selected date.
 */
export function usePassengerListsPage() {
  const today = useMemo(() => formatDateToISO(new Date()), [])
  const [selectedRideId, setSelectedRideId] = useState<string>(ALL_RIDES_OPTION)
  const [selectedDate, setSelectedDate] = useState<string>(today)

  const ridesQuery = useRidesListQuery()
  const rides = ridesQuery.data ?? EMPTY_RIDES
  const countsQuery = useReservationCountsQuery(selectedDate, selectedDate)

  const scheduledRides = useMemo(
    () => rides.filter((ride) => ride.status === "scheduled"),
    [rides]
  )

  const rideOptions = useMemo<RideFilterOption[]>(
    () =>
      scheduledRides
        .map((ride) => ({ value: ride.id, label: ride.line.name }))
        .sort((left, right) => left.label.localeCompare(right.label, "sr-Latn-RS")),
    [scheduledRides]
  )

  const allInstances = useMemo(
    () =>
      generateUpcomingRideInstances(scheduledRides, {
        from: selectedDate,
        until: new Date(`${selectedDate}T00:00:00`),
      }),
    [scheduledRides, selectedDate]
  )

  const items = useMemo<UpcomingRideListItem[]>(() => {
    const counts = countsQuery.data

    return allInstances
      .filter(
        (instance) =>
          instance.date === selectedDate &&
          (selectedRideId === ALL_RIDES_OPTION || instance.rideId === selectedRideId)
      )
      .map((rideInstance) => ({
        rideInstance,
        passengerCount:
          counts?.get(
            rideInstanceCountKey(
              rideInstance.rideId,
              rideInstance.date,
              rideInstance.departureTime
            )
          ) ?? 0,
        capacity: rideInstance.ride.busCapacity,
      }))
  }, [allInstances, countsQuery.data, selectedDate, selectedRideId])

  return {
    items,
    rideOptions,
    selectedRideId,
    setSelectedRideId,
    selectedDate,
    setSelectedDate,
    isLoading: ridesQuery.isLoading,
    isCountsLoading: countsQuery.isLoading,
    isError: ridesQuery.isError,
    error: ridesQuery.error,
    refetch: ridesQuery.refetch,
  }
}
