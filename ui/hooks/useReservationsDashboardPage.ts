import { useMemo, useState } from "react"
import { useRidesListQuery } from "@/infrastructure/hooks/queries/useRidesListQuery"
import { useRunningDeparturesQuery } from "@/infrastructure/hooks/queries/useDeparturesQuery"
import { formatDateToISO } from "@/utils/dateHelpers"
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
  const selectedDateIso = isValidDate(selectedDate) ? formatDateToISO(selectedDate) : ""
  const departuresQuery = useRunningDeparturesQuery(
    { from: selectedDateIso, to: selectedDateIso },
    rides,
    { enabled: Boolean(selectedDateIso) }
  )
  const storefrontIconQuery = useStorefrontRideIconQuery(tenantSlug, {
    enabled: hasHydrated && isAuthenticated,
  })
  const rideInstances = departuresQuery.instances
  const loading = ridesQuery.isLoading || departuresQuery.isLoading

  return {
    rides,
    rideInstances,
    rideIconUrl: storefrontIconQuery.data ?? null,
    loading,
    setSelectedDate,
    selectedDate: selectedDate && isValidDate(selectedDate) ? selectedDate : undefined,
  }
}
