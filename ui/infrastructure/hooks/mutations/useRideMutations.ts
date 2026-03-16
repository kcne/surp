import { useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import {
  ridesControllerAddException,
  ridesControllerCreate,
  ridesControllerCreateResponse,
  ridesControllerGetById,
  ridesControllerGetByIdResponse,
  ridesControllerRemove,
  ridesControllerRemoveException,
  ridesControllerRemoveResponse,
  ridesControllerReplace,
  ridesControllerReplaceDayTimes,
  ridesControllerReplaceDayTimesResponse,
  ridesControllerReplaceResponse,
  ridesControllerUpdate,
  ridesControllerUpdateResponse,
} from "@/infrastructure/generated/surp-api"
import {
  toCreateRideDto,
  toCreateRideExceptionDto,
  toReplaceRideDayTimesDto,
  toUpdateRideDto,
} from "@/infrastructure/mappers/rideMappers"
import { ridesListQueryKey } from "@/infrastructure/hooks/queries/useRidesListQuery"
import type { RideFormData } from "@/types"

function isRideMutationSuccess<TResponse extends { status: number }>(
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

function invalidateRidesList(queryClient: ReturnType<typeof useQueryClient>) {
  queryClient.invalidateQueries({ queryKey: ridesListQueryKey })
}

function hasPatchableFields(data: Partial<RideFormData>): boolean {
  const payload = toUpdateRideDto(data)
  return Object.values(payload).some((value) => value !== undefined)
}

function isCreateRideSuccess(
  response: ridesControllerCreateResponse
): response is Extract<ridesControllerCreateResponse, { status: 200 | 201 }> {
  return response.status >= 200 && response.status < 300
}

function isGetRideByIdSuccess(
  response: ridesControllerGetByIdResponse
): response is Extract<ridesControllerGetByIdResponse, { status: 200 }> {
  return response.status === 200
}

function isReplaceDayTimesSuccess(
  response: ridesControllerReplaceDayTimesResponse
): response is Extract<ridesControllerReplaceDayTimesResponse, { status: 200 }> {
  return response.status === 200
}

function isUpdateRideSuccess(
  response: ridesControllerUpdateResponse | ridesControllerReplaceResponse
): boolean {
  return response.status >= 200 && response.status < 300
}

export function useCreateRideMutation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (payload: RideFormData) => {
      const createResponse = await ridesControllerCreate(toCreateRideDto(payload))
      if (!isCreateRideSuccess(createResponse)) {
        throw new Error("Neuspesno kreiranje voznje")
      }

      if (payload.exceptions?.length) {
        for (const exception of payload.exceptions) {
          const addExceptionResponse = await ridesControllerAddException(
            createResponse.data.id,
            toCreateRideExceptionDto(exception)
          )

          if (!isRideMutationSuccess(addExceptionResponse)) {
            throw new Error("Neuspesno dodavanje izuzetka voznje")
          }
        }
      }

      const detailResponse = await ridesControllerGetById(createResponse.data.id)
      if (!isGetRideByIdSuccess(detailResponse)) {
        throw new Error("Neuspesno ucitavanje detalja voznje")
      }

      return detailResponse.data
    },
    onSuccess: () => {
      toast.success("Voznja je uspesno kreirana")
      invalidateRidesList(queryClient)
    },
    onError: (error) => {
      toast.error(getErrorMessage(error, "Neuspesno kreiranje voznje"))
    },
  })
}

export function useUpdateRideMutation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, payload }: { id: string; payload: Partial<RideFormData> }) => {
      const hasExceptionsUpdate = Array.isArray(payload.exceptions)
      const hasDayTimesUpdate = payload.dayTimes !== undefined

      if (hasDayTimesUpdate) {
        const dayTimesResponse = await ridesControllerReplaceDayTimes(
          id,
          toReplaceRideDayTimesDto(payload.dayTimes)
        )

        if (!isReplaceDayTimesSuccess(dayTimesResponse)) {
          throw new Error("Neuspesno azuriranje rasporeda vremena voznje")
        }
      }

      if (hasPatchableFields(payload)) {
        const updatePayload = toUpdateRideDto(
          hasDayTimesUpdate
            ? {
                ...payload,
                dayTimes: undefined,
              }
            : payload
        )

        const response = payload.lineId && payload.type
          ? await ridesControllerReplace(id, updatePayload)
          : await ridesControllerUpdate(id, updatePayload)

        const isSuccess = isUpdateRideSuccess(response)

        if (!isSuccess) {
          throw new Error("Neuspesno azuriranje voznje")
        }
      }

      if (hasExceptionsUpdate) {
        const currentResponse = await ridesControllerGetById(id)
        if (!isGetRideByIdSuccess(currentResponse)) {
          throw new Error("Neuspesno ucitavanje izuzetaka voznje")
        }

        const existingExceptions = currentResponse.data.exceptions
        const nextExceptions = payload.exceptions ?? []

        const nextIds = new Set(nextExceptions.map((exception) => exception.id))
        const existingIds = new Set(existingExceptions.map((exception) => exception.id))

        const toRemove = existingExceptions.filter((exception) => !nextIds.has(exception.id))
        const toAdd = nextExceptions.filter((exception) => !existingIds.has(exception.id))

        for (const exception of toRemove) {
          const removeResponse = await ridesControllerRemoveException(id, exception.id)
          if (!isRideMutationSuccess(removeResponse)) {
            throw new Error("Neuspesno uklanjanje izuzetka voznje")
          }
        }

        for (const exception of toAdd) {
          const addResponse = await ridesControllerAddException(
            id,
            toCreateRideExceptionDto(exception)
          )
          if (!isRideMutationSuccess(addResponse)) {
            throw new Error("Neuspesno dodavanje izuzetka voznje")
          }
        }
      }

      const detailResponse = await ridesControllerGetById(id)
      if (!isGetRideByIdSuccess(detailResponse)) {
        throw new Error("Neuspesno ucitavanje detalja voznje")
      }

      return detailResponse.data
    },
    onSuccess: () => {
      toast.success("Voznja je uspesno azurirana")
      invalidateRidesList(queryClient)
    },
    onError: (error) => {
      toast.error(getErrorMessage(error, "Neuspesno azuriranje voznje"))
    },
  })
}

export function useDeleteRideMutation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (id: string) => {
      const response = await ridesControllerRemove(id)
      if (!isRideMutationSuccess(response)) {
        throw new Error("Neuspesno brisanje voznje")
      }
      return response.data
    },
    onSuccess: () => {
      toast.success("Voznja je uspesno obrisana")
      invalidateRidesList(queryClient)
    },
    onError: (error) => {
      toast.error(getErrorMessage(error, "Neuspesno brisanje voznje"))
    },
  })
}
