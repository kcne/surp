import { useCallback, useEffect, useMemo } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { useRidesListQuery } from "@/infrastructure/hooks/queries/useRidesListQuery"
import { useRunningDeparturesQuery } from "@/infrastructure/hooks/queries/useDeparturesQuery"
import { formatDateToISO } from "@/utils/dateHelpers"
import { useStorefrontRideIconQuery } from "@/infrastructure/hooks/queries/useStorefrontRideIconQuery"
import { getTenantSlug } from "@/infrastructure/utils/storage"
import { useAuthStore } from "@/stores/authStore"
import { parseReservationsDateParam, reservationsListHref } from "@/utils/reservationsDateParam"

export function useReservationsDashboardPage() {
  const { hasHydrated, isAuthenticated } = useAuthStore()
  const tenantSlug = hasHydrated ? getTenantSlug() : null
  const router = useRouter()
  const dateParam = useSearchParams()?.get("date") ?? null
  const selectedDate = useMemo(() => parseReservationsDateParam(dateParam), [dateParam])
  const selectedDateIso = formatDateToISO(selectedDate)
  // Replace, not push: browsing day by day should not fill the back history.
  // history.replaceState rather than router.replace: Next 14.1+ syncs
  // useSearchParams with it, without the server round trip router.replace
  // makes for every new search string.
  const setSelectedDate = useCallback((date: Date) => {
    window.history.replaceState(null, "", reservationsListHref(date))
  }, [])
  // A malformed or past ?date= shows today; the URL is corrected to match.
  useEffect(() => {
    if (dateParam !== null && dateParam !== selectedDateIso) {
      router.replace(reservationsListHref(selectedDate), { scroll: false })
    }
  }, [dateParam, selectedDateIso, selectedDate, router])
  const ridesQuery = useRidesListQuery()
  const rides = useMemo(() => ridesQuery.data || [], [ridesQuery.data])
  const departuresQuery = useRunningDeparturesQuery(
    { from: selectedDateIso, to: selectedDateIso },
    rides
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
    selectedDate,
  }
}
