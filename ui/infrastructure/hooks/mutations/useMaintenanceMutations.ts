import { useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { maintenanceControllerRealignSchedules } from "@/infrastructure/generated/surp-api"
import { scheduleDriftQueryKey } from "@/infrastructure/hooks/queries/useScheduleDriftQuery"
import type { ScheduleRealignResultDto } from "@/infrastructure/generated/model"

export function useRealignSchedulesMutation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (): Promise<ScheduleRealignResultDto> => {
      const response = await maintenanceControllerRealignSchedules()

      if (response.status !== 200) {
        throw new Error(
          response.status === 403
            ? "Samo admin moze da pokrene osvezavanje rasporeda"
            : "Neuspesno osvezavanje rasporeda"
        )
      }

      return response.data
    },
    onSuccess: (result) => {
      if (result.realignedScheduleCount === 0) {
        toast.success("Svi rasporedi su vec uskladjeni")
      } else {
        toast.success(`Uskladjeno ${result.realignedScheduleCount} rasporeda`)
      }

      queryClient.invalidateQueries({ queryKey: scheduleDriftQueryKey })
      // Ride instances derive their times from day schedules.
      queryClient.invalidateQueries({ queryKey: ["rides"] })
    },
    onError: (error) => {
      toast.error(
        error instanceof Error && error.message ? error.message : "Neuspesno osvezavanje rasporeda"
      )
    },
  })
}
