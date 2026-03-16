import { useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import {
  linesControllerCreate,
  linesControllerCreateReverse,
  linesControllerRemove,
  linesControllerRemoveResponse,
  linesControllerUpdate,
  linesControllerUpdateResponse,
  linesControllerCreateReverseResponse,
} from "@/infrastructure/generated/surp-api"
import type { CreateLineDto, UpdateLineDto } from "@/infrastructure/generated/model"
import { linesListQueryKey } from "@/infrastructure/hooks/queries/useLinesListQuery"

function isLineMutationSuccess<TResponse extends { status: number }>(
  response: TResponse,
  expectedStatus?: number
): boolean {
  if (expectedStatus !== undefined) {
    return response.status === expectedStatus
  }

  return response.status >= 200 && response.status < 300
}

function hasLineIdPayload(response: { data?: unknown }): response is { data: { id: string } } {
  if (!response || typeof response !== "object") {
    return false
  }

  const data = response.data
  if (!data || typeof data !== "object") {
    return false
  }

  return typeof (data as { id?: unknown }).id === "string"
}

function getErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message) {
    return error.message
  }

  return fallback
}

function invalidateLinesList(queryClient: ReturnType<typeof useQueryClient>) {
  queryClient.invalidateQueries({ queryKey: linesListQueryKey })
}

export function useCreateLineMutation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (payload: CreateLineDto) => {
      const response = await linesControllerCreate(payload)
      if (!isLineMutationSuccess(response) || !hasLineIdPayload(response)) {
        throw new Error("Neuspesno kreiranje linije")
      }

      return response.data
    },
    onSuccess: () => {
      toast.success("Linija je uspesno kreirana")
      invalidateLinesList(queryClient)
    },
    onError: (error) => {
      toast.error(getErrorMessage(error, "Neuspesno kreiranje linije"))
    },
  })
}

export function useUpdateLineMutation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, payload }: { id: string; payload: UpdateLineDto }) => {
      const response = await linesControllerUpdate(id, payload)
      if (!isLineMutationSuccess<linesControllerUpdateResponse>(response)) {
        throw new Error("Neuspesno azuriranje linije")
      }
      return response.data
    },
    onSuccess: () => {
      toast.success("Linija je uspesno azurirana")
      invalidateLinesList(queryClient)
    },
    onError: (error) => {
      toast.error(getErrorMessage(error, "Neuspesno azuriranje linije"))
    },
  })
}

export function useDeleteLineMutation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (id: string) => {
      const response = await linesControllerRemove(id)
      if (!isLineMutationSuccess<linesControllerRemoveResponse>(response)) {
        throw new Error("Neuspesno brisanje linije")
      }
      return response.data
    },
    onSuccess: () => {
      toast.success("Linija je uspesno obrisana")
      invalidateLinesList(queryClient)
    },
    onError: (error) => {
      toast.error(getErrorMessage(error, "Neuspesno brisanje linije"))
    },
  })
}

export function useReverseLineMutation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (id: string) => {
      const response = await linesControllerCreateReverse(id)
      if (!isLineMutationSuccess<linesControllerCreateReverseResponse>(response)) {
        throw new Error("Neuspesno kreiranje obrnute linije")
      }
      return response.data
    },
    onSuccess: () => {
      toast.success("Obrnuta linija je uspesno kreirana")
      invalidateLinesList(queryClient)
    },
    onError: (error) => {
      toast.error(getErrorMessage(error, "Neuspesno kreiranje obrnute linije"))
    },
  })
}
