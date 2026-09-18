import { useQuery } from "@tanstack/react-query"
import {
  maintenanceControllerGetInvariant,
  maintenanceControllerGetInvariantResponse,
} from "@/infrastructure/generated/surp-api"
import type { InvariantDetailDto } from "@/infrastructure/generated/model"

export const invariantDetailQueryKey = (key: string) =>
  ["maintenance", "invariants", "detail", key] as const

function isSuccess(
  response: maintenanceControllerGetInvariantResponse
): response is Extract<maintenanceControllerGetInvariantResponse, { status: 200 }> {
  return response.status === 200
}

/** One check in full: its violations, when each appeared, and its run history. */
export function useInvariantDetailQuery(key: string | null) {
  return useQuery({
    queryKey: invariantDetailQueryKey(key ?? ""),
    enabled: Boolean(key),
    queryFn: async (): Promise<InvariantDetailDto> => {
      const response = await maintenanceControllerGetInvariant(key!)

      if (!isSuccess(response)) {
        throw new Error(
          response.status === 403
            ? "Samo admin moze da vidi provere podataka"
            : "Neuspesno ucitavanje provere"
        )
      }

      return response.data
    },
    staleTime: 0,
  })
}
