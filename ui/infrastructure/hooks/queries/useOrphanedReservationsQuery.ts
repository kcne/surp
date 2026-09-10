import { useQuery } from "@tanstack/react-query"
import {
  maintenanceControllerGetOrphanedReservations,
  maintenanceControllerGetOrphanedReservationsResponse,
} from "@/infrastructure/generated/surp-api"
import type { OrphanedReservationReportDto } from "@/infrastructure/generated/model"

export const orphanedReservationsQueryKey = ["maintenance", "orphaned-reservations"] as const

function isSuccess(
  response: maintenanceControllerGetOrphanedReservationsResponse
): response is Extract<maintenanceControllerGetOrphanedReservationsResponse, { status: 200 }> {
  return response.status === 200
}

export function useOrphanedReservationsQuery(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: orphanedReservationsQueryKey,
    enabled: options?.enabled ?? true,
    queryFn: async (): Promise<OrphanedReservationReportDto> => {
      const response = await maintenanceControllerGetOrphanedReservations()

      if (!isSuccess(response)) {
        throw new Error(
          response.status === 403
            ? "Samo admin moze da pokrene ovu proveru"
            : "Neuspesna provera izgubljenih rezervacija"
        )
      }

      return response.data
    },
    staleTime: 0,
  })
}
