import { useQuery } from "@tanstack/react-query"
import {
  maintenanceControllerGetPairDrift,
  maintenanceControllerGetPairDriftResponse,
} from "@/infrastructure/generated/surp-api"
import type { PairDriftReportDto } from "@/infrastructure/generated/model"

export const pairDriftQueryKey = ["maintenance", "pair-drift"] as const

function isPairDriftSuccess(
  response: maintenanceControllerGetPairDriftResponse
): response is Extract<maintenanceControllerGetPairDriftResponse, { status: 200 }> {
  return response.status === 200
}

export function usePairDriftQuery(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: pairDriftQueryKey,
    enabled: options?.enabled ?? true,
    queryFn: async (): Promise<PairDriftReportDto> => {
      const response = await maintenanceControllerGetPairDrift()

      if (!isPairDriftSuccess(response)) {
        throw new Error(
          response.status === 403
            ? "Samo admin moze da pokrene proveru smerova"
            : "Neuspesna provera smerova linija"
        )
      }

      return response.data
    },
    staleTime: 0,
  })
}
