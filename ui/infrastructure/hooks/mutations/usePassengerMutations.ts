import { useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import {
  PassengerResponseDto,
} from "@/infrastructure/generated/model"
import {
  passengersControllerCreate,
  passengersControllerRemove,
  passengersControllerRemoveResponse,
  passengersControllerUpdate,
  passengersControllerUpdateResponse,
} from "@/infrastructure/generated/surp-api"
import {
  toCreatePassengerDto,
  toPassenger,
  toUpdatePassengerDto,
} from "@/infrastructure/mappers/passengerMappers"
import { passengersListQueryKey } from "@/infrastructure/hooks/queries/usePassengersListQuery"
import type { PassengerFormData } from "@/types"

function isPassengerMutationSuccess<TResponse extends { status: number }>(
  response: TResponse
): boolean {
  return response.status >= 200 && response.status < 300
}

function isUpdatePassengerSuccess(
  response: passengersControllerUpdateResponse
): response is Extract<passengersControllerUpdateResponse, { status: 200 }> {
  return response.status === 200
}

function isDeletePassengerSuccess(
  response: passengersControllerRemoveResponse
): response is Extract<passengersControllerRemoveResponse, { status: 200 }> {
  return response.status === 200
}

function getErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message) {
    return error.message
  }

  return fallback
}

function invalidatePassengers(queryClient: ReturnType<typeof useQueryClient>) {
  queryClient.invalidateQueries({ queryKey: passengersListQueryKey })
  queryClient.invalidateQueries({ queryKey: ["passengers"] })
}

export function useCreatePassengerMutation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (payload: PassengerFormData) => {
      const response = await passengersControllerCreate(toCreatePassengerDto(payload))

      if (!isPassengerMutationSuccess(response)) {
        throw new Error("Neuspesno kreiranje putnika")
      }

      return toPassenger(response.data as PassengerResponseDto)
    },
    onSuccess: () => {
      toast.success("Putnik je uspesno kreiran")
      invalidatePassengers(queryClient)
    },
    onError: (error) => {
      toast.error(getErrorMessage(error, "Neuspesno kreiranje putnika"))
    },
  })
}

export function useUpdatePassengerMutation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, payload }: { id: string; payload: Partial<PassengerFormData> }) => {
      const response = await passengersControllerUpdate(id, toUpdatePassengerDto(payload))

      if (!isUpdatePassengerSuccess(response)) {
        throw new Error("Neuspesno azuriranje putnika")
      }

      return toPassenger(response.data)
    },
    onSuccess: () => {
      toast.success("Putnik je uspesno azuriran")
      invalidatePassengers(queryClient)
    },
    onError: (error) => {
      toast.error(getErrorMessage(error, "Neuspesno azuriranje putnika"))
    },
  })
}

export function useDeletePassengerMutation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (id: string) => {
      const response = await passengersControllerRemove(id)

      if (!isDeletePassengerSuccess(response) && !isPassengerMutationSuccess(response)) {
        throw new Error("Neuspesno brisanje putnika")
      }

      return response.data
    },
    onSuccess: () => {
      toast.success("Putnik je uspesno obrisan")
      invalidatePassengers(queryClient)
    },
    onError: (error) => {
      toast.error(getErrorMessage(error, "Neuspesno brisanje putnika"))
    },
  })
}
