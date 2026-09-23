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
  ridesControllerUpdateException,
  ridesControllerUpdateResponse,
} from "@/infrastructure/generated/surp-api"
import {
  toCreateRideDto,
  toCreateRideExceptionDto,
  toUiExceptions,
  toUpdateRideDto,
} from "@/infrastructure/mappers/rideMappers"
import { ridesListQueryKey } from "@/infrastructure/hooks/queries/useRidesListQuery"
import type { RideFormData } from "@/types"
import {
  ChangeNeedsConfirmationError,
  throwBreakingChangeConflict,
} from "@/infrastructure/utils/breaking-change"
import {
  answerTokens,
  type BreakingChangeAnswers,
} from "@/infrastructure/hooks/useConfirmableUpdate"

/** The confirmation key for the ride request itself; exceptions key by id. */
const RIDE_STEP = "ride"

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
      answers,
    }: {
      id: string
      payload: Partial<RideFormData>
      /**
       * The steps the agency has already answered a 409 about, by key, and how
       * it answered them. An edit is several requests and each can be refused
       * on its own terms, so an answer applies to the one request it was given
       * for — and "save anyway" and "save and repair" are different answers,
       * not one flag.
       */
      answers?: BreakingChangeAnswers
    }) => {
      const answeredFor = (step: string) => answerTokens(answers, step)
      const hasExceptionsUpdate = Array.isArray(payload.exceptions)
      // Whether any request in this edit has already been written. Every step
      // that lands sets it, not just the ride: an exception-only edit that
      // removes one exception and is then refused on the next has left the
      // first removal behind, and the dialog must not offer to cancel as
      // though nothing had happened yet.
      let anyWriteLanded = false

      if (hasPatchableFields(payload)) {
        // The day schedules travel with the ride update instead of going ahead
        // of it in their own request: anything written before it would survive
        // a "cancel" as half a change nobody agreed to — the departure time
        // already moved, the capacity change abandoned, and every reservation
        // on the old time quietly orphaned. The ride endpoint replaces the
        // schedules inside its own transaction, so either the whole edit lands
        // or none of it does, and it validates them against the line the ride
        // is being moved to rather than the one it is leaving.
        //
        // Exceptions cannot join it — they are their own endpoints — so they
        // follow, and they can be refused too. Two things follow from that:
        // once this call has landed a later refusal is no longer a clean
        // "nothing happened", which `anyWriteLanded` tells the dialog to say;
        // and each request is confirmed under its own key, so answering for
        // this one never answers for an exception nobody was asked about.
        const updatePayload = toUpdateRideDto(payload)

        const requestBody = { ...updatePayload, ...answeredFor(RIDE_STEP) }

        const response = await (
          payload.lineId && payload.type
            ? ridesControllerReplace(id, requestBody)
            : ridesControllerUpdate(id, requestBody)
        ).catch((error: unknown) => throwBreakingChangeConflict(error, RIDE_STEP))

        const isSuccess = isUpdateRideSuccess(response)

        if (!isSuccess) {
          throw new Error("Neuspesno azuriranje voznje")
        }

        anyWriteLanded = true
      }

      if (hasExceptionsUpdate) {
        const currentResponse = await ridesControllerGetById(id)
        if (!isGetRideByIdSuccess(currentResponse)) {
          throw new Error("Neuspesno ucitavanje izuzetaka voznje")
        }

        const existingExceptions = toUiExceptions(currentResponse.data.exceptions)
        const nextExceptions = payload.exceptions ?? []

        const nextIds = new Set(nextExceptions.map((exception) => exception.id))
        const existingIds = new Set(existingExceptions.map((exception) => exception.id))

        const toRemove = existingExceptions.filter((exception) => !nextIds.has(exception.id))
        const toAdd = nextExceptions.filter((exception) => !existingIds.has(exception.id))
        // An additional departure whose times changed is edited in place, not
        // removed and re-added: the reservations sold on it name its ID.
        const existingById = new Map(existingExceptions.map((exception) => [exception.id, exception]))
        const toRetime = nextExceptions.filter((exception) => {
          const existing = existingById.get(exception.id)

          return (
            existing?.type === "additional" &&
            exception.type === "additional" &&
            Boolean(exception.departureTime && exception.arrivalTime) &&
            (existing.departureTime !== exception.departureTime ||
              existing.arrivalTime !== exception.arrivalTime)
          )
        })

        for (const exception of toRemove) {
          const step = `exception:remove:${exception.id}`
          const removeResponse = await ridesControllerRemoveException(
            id,
            exception.id,
            answeredFor(step)
          ).catch((error: unknown) => throwBreakingChangeConflict(error, step, anyWriteLanded))
          if (!isRideMutationSuccess(removeResponse)) {
            throw new Error("Neuspesno uklanjanje izuzetka voznje")
          }

          anyWriteLanded = true
        }

        for (const exception of toRetime) {
          const step = `exception:update:${exception.id}`
          const updateResponse = await ridesControllerUpdateException(id, exception.id, {
            departureTime: exception.departureTime!,
            arrivalTime: exception.arrivalTime!,
            ...answeredFor(step),
          }).catch((error: unknown) => throwBreakingChangeConflict(error, step, anyWriteLanded))
          if (!isRideMutationSuccess(updateResponse)) {
            throw new Error("Neuspesna izmena vremena dodatnog polaska")
          }

          anyWriteLanded = true
        }

        for (const exception of toAdd) {
          const step = `exception:add:${exception.id}`
          const addResponse = await ridesControllerAddException(id, {
            ...toCreateRideExceptionDto(exception),
            ...answeredFor(step),
          }).catch((error: unknown) => throwBreakingChangeConflict(error, step, anyWriteLanded))
          if (!isRideMutationSuccess(addResponse)) {
            throw new Error("Neuspesno dodavanje izuzetka voznje")
          }

          anyWriteLanded = true
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
      if (error instanceof ChangeNeedsConfirmationError) {
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
