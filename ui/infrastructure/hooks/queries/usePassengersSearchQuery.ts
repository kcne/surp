import { useQuery } from "@tanstack/react-query"
import {
  passengersControllerSearch,
  passengersControllerSearchResponse,
} from "@/infrastructure/generated/surp-api"
import { toPassenger } from "@/infrastructure/mappers/passengerMappers"
import type { Passenger } from "@/types"

function isPassengersSearchSuccess(
  response: passengersControllerSearchResponse
): response is Extract<passengersControllerSearchResponse, { status: 200 }> {
  return response.status === 200
}

interface UsePassengersSearchQueryParams {
  enabled?: boolean
  pageSize?: number
}

export function usePassengersSearchQuery(
  search: string,
  params?: UsePassengersSearchQueryParams
) {
  const trimmedSearch = search.trim()

  return useQuery({
    queryKey: ["passengers", "search", trimmedSearch, params?.pageSize ?? 50],
    enabled: (params?.enabled ?? true) && trimmedSearch.length > 0,
    queryFn: async (): Promise<Passenger[]> => {
      const response = await passengersControllerSearch({
        page: 1,
        pageSize: params?.pageSize ?? 50,
        search: trimmedSearch,
        isActive: true,
      })

      if (!isPassengersSearchSuccess(response)) {
        throw new Error("Neuspesna pretraga putnika")
      }

      return response.data.items.map(toPassenger)
    },
    staleTime: 15_000,
  })
}
