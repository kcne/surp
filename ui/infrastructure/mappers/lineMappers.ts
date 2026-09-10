import type {
  CreateLineDto,
  LineResponseDto,
  LineStationSummaryDto,
  LineStationSummaryDtoCategory,
  UpdateLineDto,
} from "@/infrastructure/generated/model"
import type { Line, LineFormData, LineFormStop, Station } from "@/types"

function toStationCategory(
  category: LineStationSummaryDtoCategory
): Station["category"] {
  if (category === "BUS_STATION") {
    return "Autobuska stanica"
  }

  if (category === "BUS_STOP") {
    return "Stajalište"
  }

  return undefined
}

function toStation(station: LineStationSummaryDto): Station {
  return {
    id: station.id,
    name: station.name,
    address: station.address,
    category: toStationCategory(station.category),
  }
}

function toDirectionMode(directionMode: LineResponseDto["directionMode"]): Line["directionMode"] {
  return directionMode === "BOTH" ? "both" : "single"
}

function toDirection(direction: LineResponseDto["direction"]): Line["direction"] {
  return direction === "RETURN" ? "return" : "outbound"
}

function toIntermediateStops(stops: LineFormStop[] | undefined) {
  return stops?.map((stop, index) => ({
    stationId: stop.stationId,
    orderIndex: index + 1,
    isBoarding: stop.isBoarding,
    isDropoff: stop.isDropoff,
  }))
}

export function toLine(line: LineResponseDto): Line {
  return {
    id: line.id,
    name: line.name,
    departureStation: toStation(line.departureStation),
    arrivalStation: toStation(line.arrivalStation),
    intermediateStations: line.intermediateStops.map((stop) => ({
      stationId: stop.stationId,
      stationName: stop.stationName,
      order: stop.orderIndex,
      isBoarding: stop.isBoarding,
      isDropoff: stop.isDropoff,
    })),
    directionMode: toDirectionMode(line.directionMode),
    direction: toDirection(line.direction),
    pairKey: typeof line.pairKey === "string" ? line.pairKey : undefined,
    isActive: line.isActive,
    createdAt: line.createdAt,
    updatedAt: line.updatedAt,
  }
}

export function toCreateLineDto(data: LineFormData): CreateLineDto {
  return {
    name: data.name,
    departureStationId: data.departureStationId,
    arrivalStationId: data.arrivalStationId,
    directionMode: data.directionMode === "both" ? "BOTH" : "SINGLE",
    isActive: data.isActive ?? true,
    intermediateStops: toIntermediateStops(data.intermediateStops),
  }
}

export function toUpdateLineDto(data: Partial<LineFormData>): UpdateLineDto {
  return {
    name: data.name,
    departureStationId: data.departureStationId,
    arrivalStationId: data.arrivalStationId,
    directionMode: data.directionMode
      ? data.directionMode === "both"
        ? "BOTH"
        : "SINGLE"
      : undefined,
    isActive: data.isActive,
    intermediateStops:
      data.intermediateStops === undefined
        ? undefined
        : toIntermediateStops(data.intermediateStops),
  }
}
