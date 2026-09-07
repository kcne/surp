import { useQuery } from "@tanstack/react-query"
import {
  maintenanceControllerGetScheduleDrift,
  maintenanceControllerGetScheduleDriftResponse,
} from "@/infrastructure/generated/surp-api"
import type { ScheduleDriftReportDto } from "@/infrastructure/generated/model"

export const scheduleDriftQueryKey = ["maintenance", "schedule-drift"] as const

function isScheduleDriftSuccess(
  response: maintenanceControllerGetScheduleDriftResponse
): response is Extract<maintenanceControllerGetScheduleDriftResponse, { status: 200 }> {
  return response.status === 200
}

export function useScheduleDriftQuery(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: scheduleDriftQueryKey,
    enabled: options?.enabled ?? true,
    queryFn: async (): Promise<ScheduleDriftReportDto> => {
      const response = await maintenanceControllerGetScheduleDrift()

      if (!isScheduleDriftSuccess(response)) {
        throw new Error(
          response.status === 403
            ? "Samo admin moze da pokrene proveru rasporeda"
            : "Neuspesna provera rasporeda"
        )
      }

      return response.data
    },
    // The report is a full-tenant scan of every schedule, so re-mounting the
    // settings page should not re-run it. "Proveri" calls `refetch`, which
    // ignores staleness, so an on-demand check is still always fresh.
    staleTime: 60_000,
  })
}
