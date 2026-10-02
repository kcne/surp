import { useEffect } from "react"
import { useQuery } from "@tanstack/react-query"
import { useRouter } from "next/navigation"
import { departureWindowQueryKey, fetchDepartureWindow } from "@/infrastructure/hooks/queries/useDeparturesQuery"
import { resolveLegacyDeparture, type LegacyDepartureLink } from "@/utils/legacyDepartureLinks"

/**
 * Replaces an old ride-date-time link with the departure it meant, once the
 * ride's departures that day are read. `notFound` is set when the link meant
 * no bus, or more than one. Removed in PR 6.
 */
export function useLegacyDepartureRedirect(
  link: LegacyDepartureLink | null,
  hrefFor: (departureId: string) => string
) {
  const router = useRouter()
  const window = link ? { from: link.date, to: link.date } : { from: "", to: "" }
  const query = useQuery({
    queryKey: departureWindowQueryKey(window, { rideId: link?.rideId }),
    queryFn: () => fetchDepartureWindow(window, { rideId: link?.rideId }),
    enabled: Boolean(link),
    staleTime: 60_000,
  })
  const departureId = link && query.data ? resolveLegacyDeparture(query.data, link) : null
  const target = departureId ? hrefFor(departureId) : null

  useEffect(() => {
    if (target) {
      router.replace(target)
    }
  }, [router, target])

  return {
    resolving: Boolean(link) && (query.isLoading || Boolean(target)),
    notFound: Boolean(link) && (query.isError || (query.isSuccess && !departureId)),
  }
}
