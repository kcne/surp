import { useMemo, useState } from "react"
import { useRidesListQuery } from "@/infrastructure/hooks/queries/useRidesListQuery"
import {
  rideInstanceCountKey,
  useReservationCountsQuery,
} from "@/infrastructure/hooks/queries/useReservationCountsQuery"
import { formatDateToISO } from "@/utils/dateHelpers"
import { generateUpcomingRideInstances } from "@/utils/rideInstanceHelpers"
import type { Ride, RideInstance } from "@/types"

/** How far ahead the schedule is listed, matching the ride-instances view. */
const HORIZON_MONTHS = 3

export const ALL_RIDES_OPTION = "all"

export interface UpcomingRideListItem {
  rideInstance: RideInstance
  /** Active reservations already booked on that instance. */
  passengerCount: number
  capacity: number
}

export interface RideFilterOption {
  value: string
  label: string
}

const EMPTY_RIDES: Ride[] = []

function addMonths(date: Date, months: number): Date {
  const next = new Date(date)
  next.setMonth(next.getMonth() + months)
  return next
}

/**
 * Drives the driver-facing passenger list overview: every upcoming ride in the
 * schedule, how full it is, and the ride/date filters narrowing that down.
 *
 * Instances are expanded from the ride templates on the client — the API serves
 * them one date at a time, and a three-month window would otherwise be one
 * request per day. Passenger counts come from a single grouped count over the
 * same window.
 */
export function usePassengerListsPage() {
  const today = useMemo(() => formatDateToISO(new Date()), [])
  const horizon = useMemo(() => formatDateToISO(addMonths(new Date(), HORIZON_MONTHS)), [])

  const [selectedRideId, setSelectedRideId] = useState<string>(ALL_RIDES_OPTION)
  const [fromDate, setFromDate] = useState<string>(today)
  const [toDate, setToDate] = useState<string>("")

  const ridesQuery = useRidesListQuery()
  const rides = ridesQuery.data ?? EMPTY_RIDES
  const countsQuery = useReservationCountsQuery(fromDate || today, toDate || horizon)

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
    () => generateUpcomingRideInstances(scheduledRides, { from: fromDate || today }),
    [scheduledRides, fromDate, today]
  )

  const items = useMemo<UpcomingRideListItem[]>(() => {
    const counts = countsQuery.data

    return allInstances
      .filter((instance) => {
        if (selectedRideId !== ALL_RIDES_OPTION && instance.rideId !== selectedRideId) {
          return false
        }

        return !toDate || instance.date <= toDate
      })
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
  }, [allInstances, countsQuery.data, selectedRideId, toDate])

  const resetFilters = () => {
    setSelectedRideId(ALL_RIDES_OPTION)
    setFromDate(today)
    setToDate("")
  }

  const hasActiveFilters =
    selectedRideId !== ALL_RIDES_OPTION || fromDate !== today || toDate !== ""

  return {
    items,
    rideOptions,
    selectedRideId,
    setSelectedRideId,
    fromDate,
    setFromDate,
    toDate,
    setToDate,
    resetFilters,
    hasActiveFilters,
    isLoading: ridesQuery.isLoading,
    isCountsLoading: countsQuery.isLoading,
    isError: ridesQuery.isError,
    error: ridesQuery.error,
    refetch: ridesQuery.refetch,
  }
}
