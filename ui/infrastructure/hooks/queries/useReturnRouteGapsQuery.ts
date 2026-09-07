import { useQuery } from "@tanstack/react-query"
import {
  maintenanceControllerGetReturnRouteGaps,
  maintenanceControllerGetReturnRouteGapsResponse,
} from "@/infrastructure/generated/surp-api"
import type { ReturnRouteGapReportDto } from "@/infrastructure/generated/model"

export const returnRouteGapsQueryKey = ["maintenance", "return-route-gaps"] as const

function isSuccess(
  response: maintenanceControllerGetReturnRouteGapsResponse
): response is Extract<maintenanceControllerGetReturnRouteGapsResponse, { status: 200 }> {
  return response.status === 200
}

export function useReturnRouteGapsQuery(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: returnRouteGapsQueryKey,
    enabled: options?.enabled ?? true,
    queryFn: async (): Promise<ReturnRouteGapReportDto> => {
      const response = await maintenanceControllerGetReturnRouteGaps()

      if (!isSuccess(response)) {
        throw new Error(
          response.status === 403
            ? "Samo admin moze da pokrene ovu proveru"
            : "Neuspesna provera povratnih ruta"
        )
      }

      return response.data
    },
    staleTime: 0,
  })
}
