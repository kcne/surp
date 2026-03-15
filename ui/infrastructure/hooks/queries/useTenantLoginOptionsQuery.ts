import { usePlatformTenantsControllerListLoginOptions } from "@/infrastructure/generated/surp-api"
import type { PlatformTenantLoginOption } from "@/infrastructure/types/auth.types"

export function useTenantLoginOptionsQuery() {
  return usePlatformTenantsControllerListLoginOptions<PlatformTenantLoginOption[]>({
    query: {
      staleTime: 5 * 60 * 1000,
      select: (response) => response.data,
    },
  })
}
