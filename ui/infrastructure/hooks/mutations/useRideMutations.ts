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
  ridesControllerReplaceResponse,
  ridesControllerUpdate,
  ridesControllerUpdateResponse,
} from "@/infrastructure/generated/surp-api"
import {
  toCreateRideDto,
  toCreateRideExceptionDto,
  toUpdateRideDto,
} from "@/infrastructure/mappers/rideMappers"
import { ridesListQueryKey } from "@/infrastructure/hooks/queries/useRidesListQuery"
import type { WouldBreakReservationsDto } from "@/infrastructure/generated/model"
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

/**
 * A change the server refused because it would break reservations that already
 * exist — lowering capacity under a seat that is sold, today.
 *
 * It is not an error in the sense the other ones are: the request was valid and
 * the agency may well mean it, a smaller bus really does get substituted. So it
 * carries the server's count up to the page, which asks the question and
 * resends with the confirmation, instead of being flattened into a red toast
 * that says only that something failed.
 */
export class RideChangeNeedsConfirmationError extends Error {
  constructor(readonly confirmation: WouldBreakReservationsDto) {
    super(confirmation.message)
    this.name = "RideChangeNeedsConfirmationError"
  }
}

function asBreakingChangeConflict(error: unknown): WouldBreakReservationsDto | null {
  const body = (error as { response?: { status?: number; data?: unknown } })?.response

  if (body?.status !== 409) {
    return null
  }

  const data = body.data as Partial<WouldBreakReservationsDto> | undefined

  return data?.code === "WOULD_BREAK_RESERVATIONS" ? (data as WouldBreakReservationsDto) : null
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
    mutationFn: async ({
      id,
      payload,
      confirmBreakingChange,
    }: {
      id: string
      payload: Partial<RideFormData>
      /** Set only after the agency has answered the question the 409 asked. */
      confirmBreakingChange?: boolean
    }) => {
      const hasExceptionsUpdate = Array.isArray(payload.exceptions)

      if (hasPatchableFields(payload)) {
        // The day schedules travel with the ride update instead of going ahead
        // of it in their own request. The update is the one call that can come
        // back asking for confirmation, and anything written before it would
        // survive a "cancel" as half a change nobody agreed to: the departure
        // time already moved, the capacity change abandoned, and every
        // reservation on the old time quietly orphaned. The ride endpoint
        // replaces the schedules inside its own transaction, so either the
        // whole edit lands or none of it does — and it validates them against
        // the line the ride is being moved to rather than the one it is
        // leaving, which the dedicated day-times endpoint cannot do.
        const updatePayload = toUpdateRideDto(payload)

        const requestBody = confirmBreakingChange
          ? { ...updatePayload, confirmBreakingChange: true }
          : updatePayload

        const response = await (payload.lineId && payload.type
          ? ridesControllerReplace(id, requestBody)
          : ridesControllerUpdate(id, requestBody)
        ).catch((error: unknown) => {
          const confirmation = asBreakingChangeConflict(error)

          if (confirmation) {
            throw new RideChangeNeedsConfirmationError(confirmation)
          }

          throw error
        })

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
      // The page turns this one into a question, so a toast would only be a
      // red notice next to a dialog asking the agency to decide.
      if (error instanceof RideChangeNeedsConfirmationError) {
        return
      }

      toast.error(getErrorMessage(error, "Neuspesno azuriranje voznje"))
    },
  })
}

export function useDeleteRideMutation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (id: string) => {
      const response = await ridesControllerRemove(id, { cascade: "true" })
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
