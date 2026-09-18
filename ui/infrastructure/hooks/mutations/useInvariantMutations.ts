import { useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import {
  maintenanceControllerCheckInvariants,
  maintenanceControllerRepairInvariant,
} from "@/infrastructure/generated/surp-api"
import { invariantDetailQueryKey } from "@/infrastructure/hooks/queries/useInvariantDetailQuery"
import { invariantSummaryQueryKey } from "@/infrastructure/hooks/queries/useInvariantSummaryQuery"
import type {
  InvariantRepairResultDto,
  InvariantSummaryDto,
} from "@/infrastructure/generated/model"

/** Runs every check and stores the run, so history and the last-run time move. */
export function useCheckInvariantsMutation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (): Promise<InvariantSummaryDto> => {
      const response = await maintenanceControllerCheckInvariants()

      if (response.status !== 200) {
        throw new Error(
          response.status === 403
            ? "Samo admin moze da pokrene provere"
            : "Neuspesna provera podataka"
        )
      }

      return response.data
    },
    onSuccess: (summary) => {
      if (summary.totalViolationCount === 0) {
        toast.success(`Provereno ${summary.invariantCount} provera, sve je u redu`)
      } else {
        toast.warning(
          `${summary.violatedCount} od ${summary.invariantCount} provera prijavljuje probleme`
        )
      }

      queryClient.setQueryData(invariantSummaryQueryKey, summary)
      queryClient.invalidateQueries({ queryKey: ["maintenance", "invariants"] })
    },
    onError: (error) => {
      toast.error(
        error instanceof Error && error.message ? error.message : "Neuspesna provera podataka"
      )
    },
  })
}

/**
 * Repairs one check.
 *
 * Afterwards the stored run is out of date by exactly the rows the repair
 * touched, and editing a past run to hide that would make the history lie about
 * what was true that night. So this refetches instead: the caller re-runs the
 * checks, which records a new run saying what is true now.
 */
export function useRepairInvariantMutation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (key: string): Promise<InvariantRepairResultDto> => {
      const response = await maintenanceControllerRepairInvariant(key)

      if (response.status !== 200) {
        throw new Error(
          response.status === 403
            ? "Samo admin moze da pokrene popravku"
            : "Neuspesna popravka"
        )
      }

      return response.data
    },
    onSuccess: (result) => {
      if (result.repairedCount === 0) {
        toast.success("Nije bilo sta da se popravi")
      } else {
        toast.success(`Popravljeno ${result.repairedCount}`)
      }

      if (result.skippedCount > 0) {
        toast.warning(`Preskoceno ${result.skippedCount} — treba ih resiti rucno`)
      }

      queryClient.invalidateQueries({ queryKey: invariantSummaryQueryKey })
      queryClient.invalidateQueries({ queryKey: invariantDetailQueryKey(result.key) })
      // A repair moves reservations, seats and schedules, so anything showing
      // them is stale.
      queryClient.invalidateQueries({ queryKey: ["reservations"] })
      queryClient.invalidateQueries({ queryKey: ["rides"] })
      queryClient.invalidateQueries({ queryKey: ["lines"] })
    },
    onError: (error) => {
      toast.error(error instanceof Error && error.message ? error.message : "Neuspesna popravka")
    },
  })
}
