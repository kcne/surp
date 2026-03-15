import { useEffect } from "react"
import { useRidesStore } from "@/stores/ridesStore"

function isValidDate(date: unknown): date is Date {
  return date instanceof Date && !Number.isNaN(date.getTime())
}

export function useReservationsDashboardPage() {
  const { fetchRides, fetchRideInstances, rideInstances, selectedDate, loading } = useRidesStore()

  useEffect(() => {
    fetchRides()
    if (selectedDate && isValidDate(selectedDate)) {
      fetchRideInstances(selectedDate)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return {
    rideInstances,
    loading,
    selectedDate: selectedDate && isValidDate(selectedDate) ? selectedDate : undefined,
  }
}
