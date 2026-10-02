import type { DepartureResponseDto } from "@/infrastructure/generated/model"
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
