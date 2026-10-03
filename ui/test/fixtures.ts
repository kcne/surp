import type { DepartureResponseDto, ReservationResponseDto } from "@/infrastructure/generated/model"
import type { Ride } from "@/types"

export function departure(overrides: Partial<DepartureResponseDto> = {}): DepartureResponseDto {
  return {
    id: "dep-1",
    rideId: "ride-1",
    rideName: "Novi Sad - Beograd",
    lineId: "line-1",
    lineName: "Novi Sad - Beograd",
    serviceDate: "2026-10-05",
    source: "SCHEDULE",
    departureTime: "09:00",
    arrivalTime: "10:30",
    capacity: 48,
    activeReservationCount: 0,
    availableSeats: 48,
    timetableDroppedAt: null,
    cancelledAt: null,
    cancelledById: null,
    stops: [
      { stationId: "st-ns", stationName: "Novi Sad", orderIndex: 0, time: "09:00", isBoarding: true, isDropoff: false },
      { stationId: "st-in", stationName: "Indjija", orderIndex: 1, time: null, isBoarding: true, isDropoff: true },
      { stationId: "st-bg", stationName: "Beograd", orderIndex: 2, time: "10:30", isBoarding: false, isDropoff: true },
    ],
    createdAt: "2026-10-01T00:00:00.000Z",
    updatedAt: "2026-10-01T00:00:00.000Z",
    ...overrides,
  }
}

export function ride(overrides: Partial<Ride> = {}): Ride {
  return {
    id: "ride-1",
    name: "Novi Sad - Beograd",
    busCapacity: 48,
    type: "recurring",
    status: "scheduled",
    line: {
      id: "line-1",
      name: "Novi Sad - Beograd",
      departureStation: { id: "st-ns", name: "Novi Sad", address: "" },
      arrivalStation: { id: "st-bg", name: "Beograd", address: "" },
      intermediateStations: [
        { stationId: "st-in", stationName: "Indjija", order: 1, isBoarding: true, isDropoff: true },
      ],
      isActive: true,
    },
    ...overrides,
  }
}

export function reservationResponse(
  overrides: Partial<ReservationResponseDto> = {}
): ReservationResponseDto {
  return {
    id: "res-1",
    tenantId: "tenant-1",
    rideId: "ride-1",
    departureId: "dep-1" as unknown as ReservationResponseDto["departureId"],
    passengerId: "pass-1",
    createdById: null,
    updatedById: null,
    travelDate: "2026-10-05",
    rideDepartureTime: "09:00",
    rideArrivalTime: "10:30",
    seatNumber: 1,
    status: "ACTIVE",
    cancelledAt: null,
    departureStationId: "st-ns",
    arrivalStationId: "st-bg",
    groupId: null,
    roundTripId: null,
    returnOfReservationId: null,
    notes: null,
    ride: { id: "ride-1", name: "Novi Sad - Beograd", lineId: "line-1" },
    passenger: { id: "pass-1", firstName: "Ana", lastName: "Petrovic", phone: "+381601234567" },
    departureStation: { id: "st-ns", name: "Novi Sad" },
    arrivalStation: { id: "st-bg", name: "Beograd" },
    createdAt: "2026-10-01T00:00:00.000Z",
    updatedAt: "2026-10-01T00:00:00.000Z",
    ...overrides,
  }
}

/** The error the API client throws for a refused booking. */
export function refusal(code: string, message: string, status = 409) {
  return Object.assign(new Error(`Request failed with status code ${status}`), {
    response: { status, data: { code, message } },
  })
}
