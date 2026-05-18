import { useQuery } from "@tanstack/react-query"
import { storefrontAdminControllerGetCurrent } from "@/infrastructure/generated/surp-api"
import { resolveStorefrontImageUrl, type StorefrontAdminResponse } from "@/lib/storefront"

export const storefrontRideIconQueryKey = (tenantSlug: string | null) =>
  ["storefront", "ride-icon", tenantSlug ?? "none"] as const

async function fetchStorefrontRideIconUrl(): Promise<string | null> {
  const response = await storefrontAdminControllerGetCurrent()

  if (response.status !== 200) {
    throw new Error("Neuspesno ucitavanje ikonice za rezervacije")
  }

  const storefront = response.data as StorefrontAdminResponse
  return storefront.rideIconUrl ? resolveStorefrontImageUrl(storefront.rideIconUrl) : null
}

export function useStorefrontRideIconQuery(
  tenantSlug: string | null,
  options?: { enabled?: boolean }
) {
  return useQuery({
    queryKey: storefrontRideIconQueryKey(tenantSlug),
    enabled: Boolean(tenantSlug) && (options?.enabled ?? true),
    queryFn: fetchStorefrontRideIconUrl,
    staleTime: 60_000,
  })
}
