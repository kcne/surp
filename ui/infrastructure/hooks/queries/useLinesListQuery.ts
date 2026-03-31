import { useQuery } from "@tanstack/react-query"
import {
  linesControllerList,
  linesControllerListResponse,
} from "@/infrastructure/generated/surp-api"
import { toLine } from "@/infrastructure/mappers/lineMappers"
import type { Line } from "@/types"

const linesListParams = { isActive: true } as const

export const linesListQueryKey = ["lines", "list", linesListParams] as const

function isLinesListSuccess(
  response: linesControllerListResponse
): response is Extract<linesControllerListResponse, { status: 200 }> {
  return response.status === 200
}

export function useLinesListQuery() {
  return useQuery({
    queryKey: linesListQueryKey,
    queryFn: async (): Promise<Line[]> => {
      const response = await linesControllerList(linesListParams)
      if (!isLinesListSuccess(response)) {
        throw new Error("Neuspesno ucitavanje linija")
      }
      return response.data.items.map(toLine)
    },
    staleTime: 60_000,
  })
}
