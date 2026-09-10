import { useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import {
  maintenanceControllerRealignSchedules,
  maintenanceControllerRepairOrphanedReservations,
  maintenanceControllerSyncPairs,
} from "@/infrastructure/generated/surp-api"
import { orphanedReservationsQueryKey } from "@/infrastructure/hooks/queries/useOrphanedReservationsQuery"
import { pairDriftQueryKey } from "@/infrastructure/hooks/queries/usePairDriftQuery"
import { scheduleDriftQueryKey } from "@/infrastructure/hooks/queries/useScheduleDriftQuery"
import type {
  OrphanedReservationRepairResultDto,
  PairSyncResultDto,
  ScheduleRealignResultDto,
} from "@/infrastructure/generated/model"

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

export function useSyncLinePairsMutation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (): Promise<PairSyncResultDto> => {
      const response = await maintenanceControllerSyncPairs()

      if (response.status !== 200) {
        throw new Error(
          response.status === 403
            ? "Samo admin moze da uskladi smerove linija"
            : "Neuspesno uskladjivanje smerova"
        )
      }

      return response.data
    },
    onSuccess: (result) => {
      if (result.syncedPairCount === 0 && result.skippedPairCount === 0) {
        toast.success("Svi smerovi su vec uskladjeni")
      } else if (result.skippedPairCount > 0) {
        toast.warning(
          `Uskladjeno ${result.syncedPairCount}, preskoceno ${result.skippedPairCount} parova`
        )
      } else {
        toast.success(`Uskladjeno ${result.syncedPairCount} parova linija`)
      }

      queryClient.invalidateQueries({ queryKey: pairDriftQueryKey })
      // Routes changed, so schedules and ride instances follow.
      queryClient.invalidateQueries({ queryKey: scheduleDriftQueryKey })
      queryClient.invalidateQueries({ queryKey: ["lines"] })
      queryClient.invalidateQueries({ queryKey: ["rides"] })
    },
    onError: (error) => {
      toast.error(
        error instanceof Error && error.message ? error.message : "Neuspesno uskladjivanje smerova"
      )
    },
  })
}

export function useRepairOrphanedReservationsMutation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (): Promise<OrphanedReservationRepairResultDto> => {
      const response = await maintenanceControllerRepairOrphanedReservations()

      if (response.status !== 200) {
        throw new Error(
          response.status === 403
            ? "Samo admin moze da vrati rezervacije u sistem"
            : "Neuspesno vracanje rezervacija"
        )
      }

      return response.data
    },
    onSuccess: (result) => {
      if (result.repairedCount === 0) {
        toast.success("Nema rezervacija koje treba vratiti")
      } else if (result.seatChangedCount > 0) {
        toast.success(
          `Vraceno ${result.repairedCount} rezervacija, od toga ${result.seatChangedCount} sa novim sedistem`
        )
      } else {
        toast.success(`Vraceno ${result.repairedCount} rezervacija`)
      }

      if (result.skippedCount > 0) {
        toast.warning(`Preskoceno ${result.skippedCount} — treba ih resiti rucno`)
      }

      queryClient.invalidateQueries({ queryKey: orphanedReservationsQueryKey })
      // The reservations just became visible on their instances, which changes
      // seat maps and availability counts.
      queryClient.invalidateQueries({ queryKey: ["reservations"] })
      queryClient.invalidateQueries({ queryKey: ["rides"] })
    },
    onError: (error) => {
      toast.error(
        error instanceof Error && error.message ? error.message : "Neuspesno vracanje rezervacija"
      )
    },
  })
}
