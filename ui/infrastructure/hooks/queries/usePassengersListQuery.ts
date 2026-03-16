import { useQuery } from "@tanstack/react-query"
import {
  passengersControllerList,
  passengersControllerListResponse,
} from "@/infrastructure/generated/surp-api"
import { toPassenger } from "@/infrastructure/mappers/passengerMappers"
import type { Passenger } from "@/types"

export const passengersListQueryKey = ["passengers", "list"] as const
const MAX_PAGE_SIZE = 100

function isPassengersListSuccess(
  response: passengersControllerListResponse
): response is Extract<passengersControllerListResponse, { status: 200 }> {
  return response.status === 200
}

interface UsePassengersListQueryParams {
  pageSize?: number
  enabled?: boolean
}

export function usePassengersListQuery(params?: UsePassengersListQueryParams) {
  const pageSize = Math.min(params?.pageSize ?? MAX_PAGE_SIZE, MAX_PAGE_SIZE)

  return useQuery({
    queryKey: [...passengersListQueryKey, pageSize],
    queryFn: async (): Promise<Passenger[]> => {
      let currentPage = 1
      let total = 0
      const items: Passenger[] = []

      do {
        const response = await passengersControllerList({
          page: currentPage,
          pageSize,
          isActive: true,
        })

        if (!isPassengersListSuccess(response)) {
          throw new Error("Neuspesno ucitavanje putnika")
        }

        total = response.data.total
        items.push(...response.data.items.map(toPassenger))
        currentPage += 1
      } while (items.length < total)

      return items
    },
    enabled: params?.enabled,
    staleTime: 60_000,
  })
}
