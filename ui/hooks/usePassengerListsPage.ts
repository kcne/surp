import { useMemo, useState } from "react"
import { useRidesListQuery } from "@/infrastructure/hooks/queries/useRidesListQuery"
import { useRunningDeparturesQuery } from "@/infrastructure/hooks/queries/useDeparturesQuery"
import { formatDateToISO } from "@/utils/dateHelpers"
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
 * The day's running departures are read as stored (#27, PR 4a), each with the
 * active reservations booked on it.
 */
export function usePassengerListsPage() {
  const today = useMemo(() => formatDateToISO(new Date()), [])
  const [selectedRideId, setSelectedRideId] = useState<string>(ALL_RIDES_OPTION)
  const [selectedDate, setSelectedDate] = useState<string>(today)

  const ridesQuery = useRidesListQuery()
  const rides = ridesQuery.data ?? EMPTY_RIDES
  const departuresQuery = useRunningDeparturesQuery(
    { from: selectedDate, to: selectedDate },
    rides
  )

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

  const items = useMemo<UpcomingRideListItem[]>(
    () =>
      departuresQuery.instances
        .filter(
          (instance) =>
            selectedRideId === ALL_RIDES_OPTION || instance.rideId === selectedRideId
        )
        .map((rideInstance) => ({
          rideInstance,
          passengerCount: rideInstance.reservationCount ?? 0,
          capacity: rideInstance.ride.busCapacity,
        })),
    [departuresQuery.instances, selectedRideId]
  )

  return {
    items,
    rideOptions,
    selectedRideId,
    setSelectedRideId,
    selectedDate,
    setSelectedDate,
    isLoading: ridesQuery.isLoading || departuresQuery.isLoading,
    // Counts arrive with the departures themselves.
    isCountsLoading: departuresQuery.isLoading,
    isError: ridesQuery.isError || departuresQuery.isError,
    error: ridesQuery.error,
    refetch: ridesQuery.refetch,
  }
}
