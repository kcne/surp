import { useQuery } from "@tanstack/react-query"
import {
  maintenanceControllerGetInvariantSummary,
  maintenanceControllerGetInvariantSummaryResponse,
} from "@/infrastructure/generated/surp-api"
import type { InvariantSummaryDto } from "@/infrastructure/generated/model"

export const invariantSummaryQueryKey = ["maintenance", "invariants", "summary"] as const

function isSuccess(
  response: maintenanceControllerGetInvariantSummaryResponse
): response is Extract<maintenanceControllerGetInvariantSummaryResponse, { status: 200 }> {
  return response.status === 200
}

/**
 * What the last stored check found. Reads only — nothing is run by opening the
 * page, so the number on screen is always tied to a run that happened.
 */
export function useInvariantSummaryQuery(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: invariantSummaryQueryKey,
    enabled: options?.enabled ?? true,
    queryFn: async (): Promise<InvariantSummaryDto> => {
      const response = await maintenanceControllerGetInvariantSummary()

      if (!isSuccess(response)) {
        throw new Error(
          response.status === 403
            ? "Samo admin moze da vidi provere podataka"
            : "Neuspesno ucitavanje provera"
        )
      }

      return response.data
    },
    staleTime: 0,
  })
}
