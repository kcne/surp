import { useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import {
  departuresControllerCancel,
  departuresControllerCreateExtra,
  departuresControllerDeleteExtra,
  departuresControllerRestore,
  departuresControllerUpdateExtra,
} from "@/infrastructure/generated/surp-api"
import type { DepartureResponseDto } from "@/infrastructure/generated/model"
import { departuresQueryKey } from "@/infrastructure/hooks/queries/useDeparturesQuery"
import { ridesListQueryKey } from "@/infrastructure/hooks/queries/useRidesListQuery"
import {
  answerTokens,
  type BreakingChangeAnswers,
} from "@/infrastructure/hooks/useConfirmableUpdate"
import {
  ChangeNeedsConfirmationError,
  throwBreakingChangeConflict,
} from "@/infrastructure/utils/breaking-change"

/**
 * Operator decisions on one departure (#27, PR 4c): cancel and restore a bus,
 * and add, edit and delete an extra one, through `/departures`. Until PR 6
 * the API also writes the ride's exception rows, so the rides list is
 * refreshed with the departures.
 */

/**
 * The server's own sentence for a refused departure operation: a state
 * refusal (already cancelled, not an extra, booked), a date outside the
 * allowed range, or a validation failure. These say what to do next, so they
 * are shown as sent.
 */
export function departureOperationMessage(error: unknown): string | null {
  const response = (error as { response?: { status?: number; data?: unknown } })?.response

  if (response?.status !== 409 && response?.status !== 400 && response?.status !== 404) {
    return null
  }

  if (response.status === 404) {
    return "Polazak vise ne postoji. Osvezite listu polazaka."
  }

  const message = (response.data as { message?: unknown } | undefined)?.message

  if (typeof message === "string") {
    return message
  }

  // Validation failures arrive as a list of sentences.
  return Array.isArray(message) && message.every((item) => typeof item === "string")
    ? message.join(" ")
    : null
}

function useRefreshAfterDepartureWrite() {
  const queryClient = useQueryClient()

  return () => {
    queryClient.invalidateQueries({ queryKey: departuresQueryKey })
    queryClient.invalidateQueries({ queryKey: ridesListQueryKey })
  }
}

function toastFailure(error: unknown, fallback: string) {
  // The page turns this one into a question.
  if (error instanceof ChangeNeedsConfirmationError) {
    return
  }

  toast.error(departureOperationMessage(error) ?? fallback)
}

function expectSuccess<TResponse extends { status: number; data: unknown }>(
  response: TResponse,
  failure: string
): DepartureResponseDto {
  if (response.status < 200 || response.status >= 300) {
    throw new Error(failure)
  }

  return response.data as DepartureResponseDto
}

export interface CancelDepartureVariables {
  id: string
  answers?: BreakingChangeAnswers
}

export function useCancelDepartureMutation() {
  const refresh = useRefreshAfterDepartureWrite()

  return useMutation({
    mutationFn: async ({ id, answers }: CancelDepartureVariables) => {
      const response = await departuresControllerCancel(id, answerTokens(answers)).catch(
        (error: unknown) => throwBreakingChangeConflict(error)
      )

      return expectSuccess(response, "Neuspesno otkazivanje polaska")
    },
    onSuccess: () => {
      toast.success("Polazak je otkazan")
      refresh()
    },
    onError: (error) => {
      // A refused cancellation may have been refused on stale data.
      if (!(error instanceof ChangeNeedsConfirmationError)) {
        refresh()
      }

      toastFailure(error, "Neuspesno otkazivanje polaska")
    },
  })
}

export function useRestoreDepartureMutation() {
  const refresh = useRefreshAfterDepartureWrite()

  return useMutation({
    mutationFn: async (id: string) =>
      expectSuccess(await departuresControllerRestore(id), "Neuspesno vracanje polaska"),
    onSuccess: () => {
      toast.success("Polazak je vracen u saobracaj")
      refresh()
    },
    onError: (error) => {
      refresh()
      toastFailure(error, "Neuspesno vracanje polaska")
    },
  })
}

export interface CreateExtraDepartureVariables {
  rideId: string
  serviceDate: string
  departureTime: string
  arrivalTime: string
  capacity?: number
}

export function useCreateExtraDepartureMutation() {
  const refresh = useRefreshAfterDepartureWrite()

  return useMutation({
    mutationFn: async (variables: CreateExtraDepartureVariables) =>
      expectSuccess(
        await departuresControllerCreateExtra(variables),
        "Neuspesno dodavanje dodatnog polaska"
      ),
    onSuccess: () => {
      toast.success("Dodatni polazak je dodat")
      refresh()
    },
    onError: (error) => toastFailure(error, "Neuspesno dodavanje dodatnog polaska"),
  })
}

export interface UpdateExtraDepartureVariables {
  id: string
  changes: { departureTime?: string; arrivalTime?: string; capacity?: number }
  answers?: BreakingChangeAnswers
}

export function useUpdateExtraDepartureMutation() {
  const refresh = useRefreshAfterDepartureWrite()

  return useMutation({
    mutationFn: async ({ id, changes, answers }: UpdateExtraDepartureVariables) => {
      const response = await departuresControllerUpdateExtra(id, {
        ...changes,
        ...answerTokens(answers),
      }).catch((error: unknown) => throwBreakingChangeConflict(error))

      return expectSuccess(response, "Neuspesna izmena dodatnog polaska")
    },
    onSuccess: () => {
      toast.success("Dodatni polazak je izmenjen")
      refresh()
    },
    onError: (error) => toastFailure(error, "Neuspesna izmena dodatnog polaska"),
  })
}

export function useDeleteExtraDepartureMutation() {
  const refresh = useRefreshAfterDepartureWrite()

  return useMutation({
    mutationFn: async (id: string) =>
      expectSuccess(await departuresControllerDeleteExtra(id), "Neuspesno brisanje dodatnog polaska"),
    onSuccess: () => {
      toast.success("Dodatni polazak je obrisan")
      refresh()
    },
    onError: (error) => {
      refresh()
      toastFailure(error, "Neuspesno brisanje dodatnog polaska")
    },
  })
}
