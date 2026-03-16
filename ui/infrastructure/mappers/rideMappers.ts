import type {
  CreateRideDto,
  CreateRideExceptionDto,
  RideDayTimeInputDto,
  RideExceptionResponseDto,
  RideInstanceResponseDto,
  RideLineSummaryDto,
  RideResponseDto,
  ReplaceRideDayTimesDto,
  UpdateRideDto,
} from "@/infrastructure/generated/model"
import type { DayTime, Line, Ride, RideException, RideFormData, RideInstance } from "@/types"

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

function toUiDayTimes(dayTimes: RideResponseDto["dayTimes"]): Record<number, DayTime> {
  const mapped: Record<number, DayTime> = {}

  dayTimes.forEach((dayTime) => {
    mapped[dayTime.dayOfWeek] = {
      departureTime: normalizeTime(dayTime.departureTime) ?? "",
      arrivalTime: normalizeTime(dayTime.arrivalTime) ?? "",
    }
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

function toApiDayTimes(dayTimes: RideFormData["dayTimes"]): RideDayTimeInputDto[] | undefined {
  if (!dayTimes) {
    return undefined
  }

  return Object.entries(dayTimes)
    .map(([day, time]) => ({
      dayOfWeek: Number(day),
      departureTime: time.departureTime,
      arrivalTime: time.arrivalTime,
    }))
    .filter((item) => item.departureTime && item.arrivalTime)
    .sort((left, right) => left.dayOfWeek - right.dayOfWeek)
}

function inferApiDayTimes(data: RideFormData | Partial<RideFormData>): RideDayTimeInputDto[] | undefined {
  const explicitDayTimes = toApiDayTimes(data.dayTimes)
  if (explicitDayTimes && explicitDayTimes.length > 0) {
    return explicitDayTimes
  }

  if (data.type === "recurring" && data.daysOfWeek?.length && data.departureTime && data.arrivalTime) {
    return data.daysOfWeek
      .map((dayOfWeek) => ({
        dayOfWeek,
        departureTime: data.departureTime as string,
        arrivalTime: data.arrivalTime as string,
      }))
      .sort((left, right) => left.dayOfWeek - right.dayOfWeek)
  }

  return undefined
}

export function toRide(dto: RideResponseDto, resolvedLine?: Line): Ride {
  const dayTimes = toUiDayTimes(dto.dayTimes)
  const daysOfWeek = Object.keys(dayTimes)
    .map((day) => Number(day))
    .sort((left, right) => left - right)

  const recurringStartDate = normalizeDate(dto.recurringStartDate)
  const recurringEndDate = normalizeDate(dto.recurringEndDate)
  const oneTimeDate = normalizeDate(dto.oneTimeDate)
  const oneTimeDepartureTime = normalizeTime(dto.oneTimeDepartureTime)
  const oneTimeArrivalTime = normalizeTime(dto.oneTimeArrivalTime)

  const legacyDepartureTime = dayTimes[daysOfWeek[0]]?.departureTime
  const legacyArrivalTime = dayTimes[daysOfWeek[0]]?.arrivalTime

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
    dayTimes,
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
      dayTimes: {},
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
    dayTimes: inferApiDayTimes(data),
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
    dayTimes: inferApiDayTimes(data),
  }
}

export function toReplaceRideDayTimesDto(dayTimes: RideFormData["dayTimes"]): ReplaceRideDayTimesDto {
  return {
    dayTimes: toApiDayTimes(dayTimes) ?? [],
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
