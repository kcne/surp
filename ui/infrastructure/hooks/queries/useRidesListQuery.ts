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
const MAX_PAGE_SIZE = 100

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

async function fetchAllRides() {
  const items: Extract<ridesControllerListResponse, { status: 200 }>["data"]["items"] = []
  let page = 1
  let total = 0

  do {
    const response = await ridesControllerList({ page, pageSize: MAX_PAGE_SIZE })
    if (!isRidesListSuccess(response)) {
      throw new Error("Neuspesno ucitavanje voznji")
    }

    items.push(...response.data.items)
    total = response.data.total
    page += 1
  } while (items.length < total)

  return items
}

async function fetchAllLines() {
  const items: Extract<linesControllerListResponse, { status: 200 }>["data"]["items"] = []
  let page = 1
  let total = 0

  do {
    const response = await linesControllerList({ page, pageSize: MAX_PAGE_SIZE, isActive: true })
    if (!isLinesListSuccess(response)) {
      throw new Error("Neuspesno ucitavanje linija")
    }

    items.push(...response.data.items)
    total = response.data.total
    page += 1
  } while (items.length < total)

  return items
}

export function useRidesListQuery() {
  return useQuery({
    queryKey: ridesListQueryKey,
    queryFn: async (): Promise<Ride[]> => {
      const [ridesItems, linesItems] = await Promise.all([
        fetchAllRides(),
        fetchAllLines(),
      ])

      const lineLookup = new Map<string, Line>(
        linesItems.map((line) => [line.id, toLine(line)])
      )

      return ridesItems.map((ride) =>
        toRide(ride, lineLookup.get(ride.lineId))
      )
    },
    staleTime: 60_000,
  })
}
