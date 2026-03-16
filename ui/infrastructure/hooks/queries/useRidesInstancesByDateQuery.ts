import { useQuery } from "@tanstack/react-query"
import {
  ridesControllerListInstancesByDate,
  ridesControllerListInstancesByDateResponse,
} from "@/infrastructure/generated/surp-api"
import { toRideInstance } from "@/infrastructure/mappers/rideMappers"
import { formatDateToISO } from "@/utils/dateHelpers"
import type { Ride, RideInstance } from "@/types"

export const ridesInstancesByDateQueryKey = (dateIso: string) =>
  ["rides", "instances", dateIso] as const

function isRidesInstancesByDateSuccess(
  response: ridesControllerListInstancesByDateResponse
): response is Extract<ridesControllerListInstancesByDateResponse, { status: 200 }> {
  return response.status === 200
}

export function useRidesInstancesByDateQuery(
  date: Date | undefined,
  rides: Ride[]
) {
  const dateIso = date ? formatDateToISO(date) : ""

  return useQuery({
    queryKey: ridesInstancesByDateQueryKey(dateIso),
    enabled: Boolean(dateIso),
    queryFn: async (): Promise<RideInstance[]> => {
      if (!date) {
        return []
      }

      const response = await ridesControllerListInstancesByDate({
        date: dateIso,
        timezoneOffsetMinutes: -date.getTimezoneOffset(),
      })

      if (!isRidesInstancesByDateSuccess(response)) {
        throw new Error("Neuspesno ucitavanje instanci voznji")
      }

      const rideLookup = new Map(rides.map((ride) => [ride.id, ride]))

      return response.data.items.map((instance) =>
        toRideInstance(instance, rideLookup.get(instance.rideId))
      )
    },
    staleTime: 60_000,
  })
}
