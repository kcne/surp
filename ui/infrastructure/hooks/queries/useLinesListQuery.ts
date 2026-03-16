import { useQuery } from "@tanstack/react-query"
import {
  linesControllerList,
  linesControllerListResponse,
} from "@/infrastructure/generated/surp-api"
import { toLine } from "@/infrastructure/mappers/lineMappers"
import type { Line } from "@/types"

export const linesListQueryKey = ["lines", "list"] as const

function isLinesListSuccess(
  response: linesControllerListResponse
): response is Extract<linesControllerListResponse, { status: 200 }> {
  return response.status === 200
}

export function useLinesListQuery() {
  return useQuery({
    queryKey: linesListQueryKey,
    queryFn: async (): Promise<Line[]> => {
      const response = await linesControllerList()
      if (!isLinesListSuccess(response)) {
        throw new Error("Neuspesno ucitavanje linija")
      }
      return response.data.items.map(toLine)
    },
    staleTime: 60_000,
  })
}
