import { useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import {
  BatchReservationsResponseDto,
  ReservationResponseDto,
} from "@/infrastructure/generated/model"
import {
  reservationsControllerCancel,
  reservationsControllerCancelResponse,
  reservationsControllerCreate,
  reservationsControllerCreateBatch,
  reservationsControllerUpdate,
  reservationsControllerUpdateResponse,
} from "@/infrastructure/generated/surp-api"
import {
  toCreateReservationDto,
  toReservation,
  toUpdateReservationDto,
} from "@/infrastructure/mappers/reservationMappers"
import { reservationsByRideInstanceQueryKey } from "@/infrastructure/hooks/queries/useReservationsByRideInstanceQuery"
import type { ReservationFormData, RideInstance } from "@/types"

function isReservationMutationSuccess<TResponse extends { status: number }>(
  response: TResponse
): boolean {
  return response.status >= 200 && response.status < 300
}

function isUpdateReservationSuccess(
  response: reservationsControllerUpdateResponse
): response is Extract<reservationsControllerUpdateResponse, { status: 200 }> {
  return response.status === 200
}

function isCancelReservationSuccess(
  response: reservationsControllerCancelResponse
): response is Extract<reservationsControllerCancelResponse, { status: 200 }> {
  return response.status === 200
}

function getErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message) {
    return error.message
  }

  return fallback
}

function invalidateReservations(
  queryClient: ReturnType<typeof useQueryClient>,
  rideInstanceIds: string[]
) {
  rideInstanceIds.forEach((rideInstanceId) => {
    queryClient.invalidateQueries({
      queryKey: reservationsByRideInstanceQueryKey(rideInstanceId),
    })
  })

  queryClient.invalidateQueries({ queryKey: ["reservations"] })
}

interface CreateReservationInput {
  data: ReservationFormData
  rideInstance: RideInstance
}

interface CreateReservationsBatchInput {
  data: ReservationFormData[]
  rideInstance: RideInstance
}

export function useCreateReservationMutation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ data, rideInstance }: CreateReservationInput) => {
      const response = await reservationsControllerCreate(toCreateReservationDto(data, rideInstance))

      if (!isReservationMutationSuccess(response)) {
        throw new Error("Neuspesno kreiranje rezervacije")
      }

      return toReservation(response.data as ReservationResponseDto, rideInstance)
    },
    onSuccess: (createdReservation) => {
      toast.success("Rezervacija je uspesno kreirana")
      invalidateReservations(queryClient, [createdReservation.rideInstanceId])
    },
    onError: (error) => {
      toast.error(getErrorMessage(error, "Neuspesno kreiranje rezervacije"))
    },
  })
}

export function useCreateReservationsBatchMutation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ data, rideInstance }: CreateReservationsBatchInput) => {
      const response = await reservationsControllerCreateBatch({
        items: data.map((item) => toCreateReservationDto(item, rideInstance)),
      })

      if (!isReservationMutationSuccess(response)) {
        throw new Error("Neuspesno kreiranje rezervacija")
      }

      const batchResponse = response.data as BatchReservationsResponseDto

      const failedItems = batchResponse.items.filter((item) => !item.success)
      if (failedItems.length > 0) {
        const firstError = failedItems[0]?.error?.message ?? "Neuspesno kreiranje rezervacija"
        throw new Error(firstError)
      }

      return {
        rideInstanceId: rideInstance.id,
        reservations: batchResponse.items
          .map((item) => item.reservation)
          .filter((item): item is NonNullable<typeof item> => Boolean(item))
          .map((item) => toReservation(item, rideInstance)),
      }
    },
    onSuccess: (result) => {
      toast.success("Rezervacije su uspesno kreirane")
      invalidateReservations(queryClient, [result.rideInstanceId])
    },
    onError: (error) => {
      toast.error(getErrorMessage(error, "Neuspesno kreiranje rezervacija"))
    },
  })
}

export function useUpdateReservationMutation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, payload }: { id: string; payload: Partial<ReservationFormData> }) => {
      const response = await reservationsControllerUpdate(id, toUpdateReservationDto(payload))

      if (!isUpdateReservationSuccess(response)) {
        throw new Error("Neuspesno azuriranje rezervacije")
      }

      return response.data
    },
    onSuccess: () => {
      toast.success("Rezervacija je uspesno azurirana")
      queryClient.invalidateQueries({ queryKey: ["reservations"] })
    },
    onError: (error) => {
      toast.error(getErrorMessage(error, "Neuspesno azuriranje rezervacije"))
    },
  })
}

export function useCancelReservationMutation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (id: string) => {
      const response = await reservationsControllerCancel(id)

      if (!isCancelReservationSuccess(response)) {
        throw new Error("Neuspesno otkazivanje rezervacije")
      }

      return response.data
    },
    onSuccess: () => {
      toast.success("Rezervacija je uspesno otkazana")
      queryClient.invalidateQueries({ queryKey: ["reservations"] })
    },
    onError: (error) => {
      toast.error(getErrorMessage(error, "Neuspesno otkazivanje rezervacije"))
    },
  })
}
