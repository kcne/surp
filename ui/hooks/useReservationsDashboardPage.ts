import { useMemo, useState } from "react"
import { useRidesListQuery } from "@/infrastructure/hooks/queries/useRidesListQuery"
import { useRidesInstancesByDateQuery } from "@/infrastructure/hooks/queries/useRidesInstancesByDateQuery"

function isValidDate(date: unknown): date is Date {
  return date instanceof Date && !Number.isNaN(date.getTime())
}

export function useReservationsDashboardPage() {
  const [selectedDate, setSelectedDate] = useState<Date>(() => new Date())
  const ridesQuery = useRidesListQuery()
  const rides = useMemo(() => ridesQuery.data || [], [ridesQuery.data])
  const rideInstancesQuery = useRidesInstancesByDateQuery(selectedDate, rides)
  const rideInstances = rideInstancesQuery.data || []
  const loading = ridesQuery.isLoading || rideInstancesQuery.isLoading

  return {
    rides,
    rideInstances,
    loading,
    setSelectedDate,
    selectedDate: selectedDate && isValidDate(selectedDate) ? selectedDate : undefined,
  }
}
