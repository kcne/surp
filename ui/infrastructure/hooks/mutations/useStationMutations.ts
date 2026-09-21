import { useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import {
  stationsControllerCreate,
  stationsControllerRemove,
  stationsControllerUpdate,
  stationsControllerCreateResponse,
  stationsControllerUpdateResponse,
  stationsControllerRemoveResponse,
} from "@/infrastructure/generated/surp-api"
import type { CreateStationDto, UpdateStationDto } from "@/infrastructure/generated/model"
import { stationsListQueryKey } from "@/infrastructure/hooks/queries/useStationsListQuery"
import {
  ChangeNeedsConfirmationError,
  throwBreakingChangeConflict,
} from "@/infrastructure/utils/breaking-change"

function isStationMutationSuccess<TResponse extends { status: number }>(
  response: TResponse,
  expectedStatus?: number
): boolean {
  if (expectedStatus !== undefined) {
    return response.status === expectedStatus
  }

  return response.status >= 200 && response.status < 300
}

function getErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message) {
    return error.message
  }

  return fallback
}

function invalidateStationsList(queryClient: ReturnType<typeof useQueryClient>) {
  queryClient.invalidateQueries({ queryKey: stationsListQueryKey })
}

export function useCreateStationMutation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (payload: CreateStationDto) => {
      const response = await stationsControllerCreate(payload)
      if (!isStationMutationSuccess<stationsControllerCreateResponse>(response)) {
        throw new Error("Neuspesno kreiranje stanice")
      }
      return response.data
    },
    onSuccess: () => {
      toast.success("Stanica je uspesno kreirana")
      invalidateStationsList(queryClient)
    },
    onError: (error) => {
      toast.error(getErrorMessage(error, "Neuspesno kreiranje stanice"))
    },
  })
}

export function useUpdateStationMutation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      id,
      payload,
      confirmBreakingChange,
      repairBreakingChange,
    }: {
      id: string
      payload: UpdateStationDto
      confirmBreakingChange?: boolean
      repairBreakingChange?: boolean
    }) => {
      const response = await stationsControllerUpdate(id, {
        ...payload,
        confirmBreakingChange,
        repairBreakingChange,
      }).catch(throwBreakingChangeConflict)
      if (!isStationMutationSuccess<stationsControllerUpdateResponse>(response)) {
        throw new Error("Neuspesno azuriranje stanice")
      }
      return response.data
    },
    onSuccess: () => {
      toast.success("Stanica je uspesno azurirana")
      invalidateStationsList(queryClient)
    },
    onError: (error) => {
      if (error instanceof ChangeNeedsConfirmationError) {
        return
      }

      toast.error(getErrorMessage(error, "Neuspesno azuriranje stanice"))
    },
  })
}

export function useDeleteStationMutation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (id: string) => {
      const response = await stationsControllerRemove(id)
      if (!isStationMutationSuccess<stationsControllerRemoveResponse>(response)) {
        throw new Error("Neuspesno brisanje stanice")
      }
      return response.data
    },
    onSuccess: () => {
      toast.success("Stanica je uspesno obrisana")
      invalidateStationsList(queryClient)
    },
    onError: (error) => {
      toast.error(getErrorMessage(error, "Neuspesno brisanje stanice"))
    },
  })
}
