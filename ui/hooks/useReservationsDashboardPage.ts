import { useMemo, useState } from "react"
import { useRidesListQuery } from "@/infrastructure/hooks/queries/useRidesListQuery"
import { useRidesInstancesByDateQuery } from "@/infrastructure/hooks/queries/useRidesInstancesByDateQuery"
import { useStorefrontRideIconQuery } from "@/infrastructure/hooks/queries/useStorefrontRideIconQuery"
import { getTenantSlug } from "@/infrastructure/utils/storage"
import { useAuthStore } from "@/stores/authStore"

function isValidDate(date: unknown): date is Date {
  return date instanceof Date && !Number.isNaN(date.getTime())
}

export function useReservationsDashboardPage() {
  const { hasHydrated, isAuthenticated } = useAuthStore()
  const tenantSlug = hasHydrated ? getTenantSlug() : null
  const [selectedDate, setSelectedDate] = useState<Date>(() => new Date())
  const ridesQuery = useRidesListQuery()
  const rides = useMemo(() => ridesQuery.data || [], [ridesQuery.data])
  const rideInstancesQuery = useRidesInstancesByDateQuery(selectedDate, rides)
  const storefrontIconQuery = useStorefrontRideIconQuery(tenantSlug, {
    enabled: hasHydrated && isAuthenticated,
  })
  const rideInstances = rideInstancesQuery.data || []
  const loading = ridesQuery.isLoading || rideInstancesQuery.isLoading

  return {
    rides,
    rideInstances,
    rideIconUrl: storefrontIconQuery.data ?? null,
    loading,
    setSelectedDate,
    selectedDate: selectedDate && isValidDate(selectedDate) ? selectedDate : undefined,
  }
}
