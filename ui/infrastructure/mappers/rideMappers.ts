import type {
  CreateRideDto,
  CreateRideExceptionDto,
  RideDayScheduleInputDto,
  RideExceptionResponseDto,
  RideInstanceResponseDto,
  RideLineSummaryDto,
  RideResponseDto,
  ReplaceRideDaySchedulesDto,
  UpdateRideDto,
} from "@/infrastructure/generated/model"
import type {
  DayScheduleStationTime,
  Line,
  Ride,
  RideException,
  RideFormData,
  RideInstance,
} from "@/types"

function pad(value: number): string {
  return String(value).padStart(2, "0")
}

function toIsoDateFromParts(year: number, month: number, day: number): string {
  return `${year}-${pad(month)}-${pad(day)}`
}

function normalizeDate(value: unknown): string | undefined {
  if (!value) {
    return undefined
  }

  if (typeof value === "string") {
    return value.includes("T") ? value.split("T")[0] : value
  }

  if (value instanceof Date) {
    return value.toISOString().slice(0, 10)
  }

  if (typeof value === "object") {
    const maybeDate = value as Record<string, unknown>

    const year = maybeDate.year
    const month = maybeDate.month
    const day = maybeDate.day

    if (
      typeof year === "number" &&
      typeof month === "number" &&
      typeof day === "number"
    ) {
      return toIsoDateFromParts(year, month, day)
    }

    const nestedDate = maybeDate.date
    if (typeof nestedDate === "string") {
      return normalizeDate(nestedDate)
    }
  }

  return undefined
}

function normalizeTime(value: unknown): string | undefined {
  if (!value) {
    return undefined
  }

  if (typeof value === "string") {
    const withoutSeconds = value.slice(0, 5)
    return withoutSeconds
  }

  if (typeof value === "object") {
    const maybeTime = value as Record<string, unknown>
    const hour = maybeTime.hour
    const minute = maybeTime.minute

    if (typeof hour === "number" && typeof minute === "number") {
      return `${pad(hour)}:${pad(minute)}`
    }

    const nestedTime = maybeTime.time
    if (typeof nestedTime === "string") {
      return normalizeTime(nestedTime)
    }
  }

  return undefined
}

function toUiRideType(type: RideResponseDto["type"]): Ride["type"] {
  return type === "ONE_TIME" ? "one-time" : "recurring"
}

function toApiRideType(type: Ride["type"]): "RECURRING" | "ONE_TIME" {
  return type === "one-time" ? "ONE_TIME" : "RECURRING"
}

function toUiRideStatus(status: RideResponseDto["status"] | RideInstanceResponseDto["status"]): Ride["status"] {
  if (status === "INACTIVE") {
    return "cancelled"
  }

  return "scheduled"
}

function toApiRideStatus(status: Ride["status"] | undefined): "DRAFT" | "ACTIVE" | "INACTIVE" | undefined {
  if (!status) {
    return undefined
  }

  if (status === "cancelled") {
    return "INACTIVE"
  }

  return "ACTIVE"
}

function toUiExceptionType(type: RideExceptionResponseDto["type"]): RideException["type"] {
  return type === "ADDITIONAL" ? "additional" : "skip"
}

function toApiExceptionType(type: RideException["type"]): "SKIP" | "ADDITIONAL" {
  return type === "additional" ? "ADDITIONAL" : "SKIP"
}

function buildStationNameLookup(line?: Line): Map<string, string> {
  const stationNameById = new Map<string, string>()
  if (!line) {
    return stationNameById
  }

  stationNameById.set(line.departureStation.id, line.departureStation.name)
  line.intermediateStations.forEach((station) => {
    stationNameById.set(station.stationId, station.stationName)
  })
  stationNameById.set(line.arrivalStation.id, line.arrivalStation.name)

  return stationNameById
}

function toUiDaySchedules(
  daySchedules: RideResponseDto["daySchedules"],
  resolvedLine?: Line
): Record<number, DayScheduleStationTime[]> {
  const mapped: Record<number, DayScheduleStationTime[]> = {}
  const stationNameById = buildStationNameLookup(resolvedLine)

  daySchedules.forEach((schedule) => {
    mapped[schedule.dayOfWeek] = schedule.stationTimes
      .map((stationTime) => ({
        stationId: stationTime.stationId,
        orderIndex: stationTime.orderIndex,
        stationName: stationNameById.get(stationTime.stationId) ?? stationTime.stationId,
        time: normalizeTime(stationTime.time) ?? "",
      }))
      .sort((left, right) => left.orderIndex - right.orderIndex)
  })

  return mapped
}

function toUiExceptions(exceptions: RideResponseDto["exceptions"]): RideException[] {
  return exceptions.map((exception) => ({
    id: exception.id,
    date: normalizeDate(exception.date) ?? "",
    type: toUiExceptionType(exception.type),
    departureTime: normalizeTime(exception.departureTime),
    arrivalTime: normalizeTime(exception.arrivalTime),
  }))
}

function toLineFallback(summary: RideLineSummaryDto): Line {
  return {
    id: summary.id,
    name: summary.name,
    departureStation: {
      id: summary.departureStationId,
      name: summary.departureStationId,
      address: "",
    },
    arrivalStation: {
      id: summary.arrivalStationId,
      name: summary.arrivalStationId,
      address: "",
    },
    intermediateStations: [],
    isActive: true,
  }
}

function pickLine(summary: RideLineSummaryDto, resolvedLine?: Line): Line {
  if (!resolvedLine) {
    return toLineFallback(summary)
  }

  return {
    ...resolvedLine,
    id: summary.id,
    name: summary.name,
  }
}

function toApiDaySchedules(
  daySchedules: RideFormData["daySchedules"]
): RideDayScheduleInputDto[] | undefined {
  if (!daySchedules) {
    return undefined
  }

  return Object.entries(daySchedules)
    .map(([day, stationTimes]) => ({
      dayOfWeek: Number(day),
      stationTimes: stationTimes
        .map((stationTime) => ({
          stationId: stationTime.stationId,
          orderIndex: stationTime.orderIndex,
          time: stationTime.time || "",
        }))
        .sort((left, right) => left.orderIndex - right.orderIndex),
    }))
    .filter((item) => item.stationTimes.length > 0)
    .sort((left, right) => left.dayOfWeek - right.dayOfWeek)
}

function inferApiDaySchedules(
  data: RideFormData | Partial<RideFormData>
): RideDayScheduleInputDto[] | undefined {
  const explicitDaySchedules = toApiDaySchedules(data.daySchedules)
  if (explicitDaySchedules && explicitDaySchedules.length > 0) {
    return explicitDaySchedules
  }

  return undefined
}

export function toRide(dto: RideResponseDto, resolvedLine?: Line): Ride {
  const daySchedules = toUiDaySchedules(dto.daySchedules, resolvedLine)
  const daysOfWeek = Object.keys(daySchedules)
    .map((day) => Number(day))
    .sort((left, right) => left - right)

  const recurringStartDate = normalizeDate(dto.recurringStartDate)
  const recurringEndDate = normalizeDate(dto.recurringEndDate)
  const oneTimeDate = normalizeDate(dto.oneTimeDate)
  const oneTimeDepartureTime = normalizeTime(dto.oneTimeDepartureTime)
  const oneTimeArrivalTime = normalizeTime(dto.oneTimeArrivalTime)

  const firstSchedule = daySchedules[daysOfWeek[0]]
  const sortedFirstSchedule = firstSchedule
    ? [...firstSchedule].sort((left, right) => left.orderIndex - right.orderIndex)
    : []
  const legacyDepartureTime = sortedFirstSchedule[0]?.time
  const legacyArrivalTime = sortedFirstSchedule[sortedFirstSchedule.length - 1]?.time

  return {
    id: dto.id,
    name: dto.name,
    line: pickLine(dto.line, resolvedLine),
    busCapacity: dto.capacity,
    type: toUiRideType(dto.type),
    status: toUiRideStatus(dto.status),
    startDate: recurringStartDate,
    endDate: recurringEndDate,
    daysOfWeek,
    departureTime: legacyDepartureTime,
    arrivalTime: legacyArrivalTime,
    daySchedules,
    exceptions: toUiExceptions(dto.exceptions),
    date: oneTimeDate,
    oneTimeDepartureTime,
    oneTimeArrivalTime,
    createdAt: dto.createdAt,
    updatedAt: dto.updatedAt,
  }
}

export function toRideInstance(dto: RideInstanceResponseDto, ride?: Ride): RideInstance {
  const fallbackRide: Ride =
    ride ?? {
      id: dto.rideId,
      name: dto.line.name,
      line: toLineFallback({
        id: dto.line.id,
        name: dto.line.name,
        departureStationId: dto.line.departureStationId,
        arrivalStationId: dto.line.arrivalStationId,
      }),
      busCapacity: dto.availability.capacity,
      type: dto.rideType === "ONE_TIME" ? "one-time" : "recurring",
      status: toUiRideStatus(dto.status),
      daySchedules: {},
      exceptions: [],
    }

  return {
    id: dto.id,
    rideId: dto.rideId,
    ride: fallbackRide,
    date: normalizeDate(dto.date) ?? "",
    departureTime: normalizeTime(dto.departureTime) ?? "",
    arrivalTime: normalizeTime(dto.arrivalTime) ?? "",
    status: toUiRideStatus(dto.status),
    reservationCount: dto.reservationCount,
    availableSeats: dto.availability.availableSeats,
  }
}

export function toCreateRideDto(data: RideFormData): CreateRideDto {
  return {
    lineId: data.lineId,
    capacity: data.busCapacity ?? 38,
    type: toApiRideType(data.type),
    status: toApiRideStatus(data.status),
    recurringStartDate: data.type === "recurring" ? data.startDate : undefined,
    recurringEndDate: data.type === "recurring" ? data.endDate : undefined,
    oneTimeDate: data.type === "one-time" ? data.date : undefined,
    oneTimeDepartureTime: data.type === "one-time" ? data.oneTimeDepartureTime : undefined,
    oneTimeArrivalTime: data.type === "one-time" ? data.oneTimeArrivalTime : undefined,
    daySchedules: inferApiDaySchedules(data),
  }
}

export function toUpdateRideDto(data: Partial<RideFormData>): UpdateRideDto {
  const apiType = data.type ? toApiRideType(data.type) : undefined

  return {
    lineId: data.lineId,
    capacity: data.busCapacity,
    type: apiType,
    status: toApiRideStatus(data.status),
    recurringStartDate:
      apiType === "RECURRING" || apiType === undefined
        ? data.startDate
        : undefined,
    recurringEndDate:
      apiType === "RECURRING" || apiType === undefined
        ? data.endDate
        : undefined,
    oneTimeDate: apiType === "ONE_TIME" || apiType === undefined ? data.date : undefined,
    oneTimeDepartureTime:
      apiType === "ONE_TIME" || apiType === undefined
        ? data.oneTimeDepartureTime
        : undefined,
    oneTimeArrivalTime:
      apiType === "ONE_TIME" || apiType === undefined
        ? data.oneTimeArrivalTime
        : undefined,
    daySchedules: inferApiDaySchedules(data),
  }
}

export function toReplaceRideDaySchedulesDto(
  daySchedules: RideFormData["daySchedules"]
): ReplaceRideDaySchedulesDto {
  return {
    daySchedules: toApiDaySchedules(daySchedules) ?? [],
  }
}

export function toCreateRideExceptionDto(exception: RideException): CreateRideExceptionDto {
  return {
    date: exception.date,
    type: toApiExceptionType(exception.type),
    departureTime: exception.departureTime,
    arrivalTime: exception.arrivalTime,
  }
}
