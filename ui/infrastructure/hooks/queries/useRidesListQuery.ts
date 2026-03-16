import { useQuery } from "@tanstack/react-query"
import {
  linesControllerList,
  linesControllerListResponse,
  ridesControllerList,
  ridesControllerListResponse,
} from "@/infrastructure/generated/surp-api"
import { toLine } from "@/infrastructure/mappers/lineMappers"
import { toRide } from "@/infrastructure/mappers/rideMappers"
import type { Line, Ride } from "@/types"

export const ridesListQueryKey = ["rides", "list"] as const

function isRidesListSuccess(
  response: ridesControllerListResponse
): response is Extract<ridesControllerListResponse, { status: 200 }> {
  return response.status === 200
}

function isLinesListSuccess(
  response: linesControllerListResponse
): response is Extract<linesControllerListResponse, { status: 200 }> {
  return response.status === 200
}

export function useRidesListQuery() {
  return useQuery({
    queryKey: ridesListQueryKey,
    queryFn: async (): Promise<Ride[]> => {
      const [ridesResponse, linesResponse] = await Promise.all([
        ridesControllerList({ page: 1, pageSize: 100 }),
        linesControllerList({ page: 1, pageSize: 100 }),
      ])

      if (!isRidesListSuccess(ridesResponse)) {
        throw new Error("Neuspesno ucitavanje voznji")
      }

      if (!isLinesListSuccess(linesResponse)) {
        throw new Error("Neuspesno ucitavanje linija")
      }

      const lineLookup = new Map<string, Line>(
        linesResponse.data.items.map((line) => [line.id, toLine(line)])
      )

      return ridesResponse.data.items.map((ride) =>
        toRide(ride, lineLookup.get(ride.lineId))
      )
    },
    staleTime: 60_000,
  })
}
