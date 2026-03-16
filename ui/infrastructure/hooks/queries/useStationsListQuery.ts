import { useQuery } from "@tanstack/react-query"
import {
  stationsControllerList,
  stationsControllerListResponse,
} from "@/infrastructure/generated/surp-api"
import type {
  StationResponseDto,
  StationResponseDtoCategory,
} from "@/infrastructure/generated/model"

export const stationsListQueryKey = ["stations", "list"] as const

export type StationListItem = {
  id: string
  name: string
  address: string
  category?: Exclude<StationResponseDtoCategory, null>
  categoryLabel: string
  contactPhone?: string
  notes?: string
  isActive: boolean
  createdAt: string
  updatedAt: string
}

const stationCategoryLabels: Record<string, string> = {
  BUS_STATION: "Autobuska stanica",
  BUS_STOP: "Stajaliste",
}

function toStationListItem(station: StationResponseDto): StationListItem {
  const category = station.category ?? undefined

  return {
    id: station.id,
    name: station.name,
    address: station.address,
    category,
    categoryLabel: category ? stationCategoryLabels[category] || category : "-",
    contactPhone: typeof station.contactPhone === "string" ? station.contactPhone : undefined,
    notes: typeof station.notes === "string" ? station.notes : undefined,
    isActive: station.isActive,
    createdAt: station.createdAt,
    updatedAt: station.updatedAt,
  }
}

function isStationsListSuccess(
  response: stationsControllerListResponse
): response is Extract<stationsControllerListResponse, { status: 200 }> {
  return response.status === 200
}

export function useStationsListQuery() {
  return useQuery({
    queryKey: stationsListQueryKey,
    queryFn: async (): Promise<StationResponseDto[]> => {
      const response = await stationsControllerList()
      if (!isStationsListSuccess(response)) {
        throw new Error("Neuspesno ucitavanje stanica")
      }
      return response.data.items
    },
    select: (items): StationListItem[] => items.map(toStationListItem),
    staleTime: 60_000,
  })
}
