import type {
  CreateReservationDto,
  ReservationResponseDto,
  UpdateReservationDto,
} from "@/infrastructure/generated/model"
import type { Reservation, ReservationFormData, RideInstance } from "@/types"

function normalizeDate(value: string): string {
  return value.includes("T") ? value.split("T")[0] : value
}

function normalizeTime(value: string): string {
  return value.slice(0, 5)
}

function toReservationStatus(status: ReservationResponseDto["status"]): Reservation["status"] {
  return status === "CANCELLED" ? "cancelled" : "active"
}

function toFallbackRideInstance(dto: ReservationResponseDto): RideInstance {
  return {
    id: `${dto.rideId}:${dto.travelDate}:${dto.rideDepartureTime}`,
    rideId: dto.rideId,
    date: normalizeDate(dto.travelDate),
    departureTime: normalizeTime(dto.rideDepartureTime),
    arrivalTime: normalizeTime(dto.rideArrivalTime),
    status: "scheduled",
    ride: {
      id: dto.ride.id,
      name: dto.ride.name,
      busCapacity: 40,
      type: "recurring",
      status: "scheduled",
      line: {
        id: dto.ride.lineId,
        name: dto.ride.name,
        departureStation: {
          id: dto.departureStation.id,
          name: dto.departureStation.name,
          address: "",
        },
        arrivalStation: {
          id: dto.arrivalStation.id,
          name: dto.arrivalStation.name,
          address: "",
        },
        intermediateStations: [],
        isActive: true,
      },
    },
  }
}

export function toReservation(dto: ReservationResponseDto, rideInstance?: RideInstance): Reservation {
  const resolvedRideInstance = rideInstance ?? toFallbackRideInstance(dto)

  return {
    id: dto.id,
    rideInstanceId: resolvedRideInstance.id,
    rideInstance: resolvedRideInstance,
    passengerId: dto.passengerId,
    passenger: {
      id: dto.passenger.id,
      firstName: dto.passenger.firstName,
      lastName: dto.passenger.lastName,
      phone: dto.passenger.phone,
      passengerType: "odrasli",
    },
    seatNumber: dto.seatNumber,
    departureStationId: dto.departureStationId,
    departureStation: {
      id: dto.departureStation.id,
      name: dto.departureStation.name,
      address: "",
    },
    arrivalStationId: dto.arrivalStationId,
    arrivalStation: {
      id: dto.arrivalStation.id,
      name: dto.arrivalStation.name,
      address: "",
    },
    status: toReservationStatus(dto.status),
    createdAt: dto.createdAt,
    updatedAt: dto.updatedAt,
  }
}

export function toCreateReservationDto(
  data: ReservationFormData,
  rideInstance: RideInstance
): CreateReservationDto {
  return {
    rideId: rideInstance.rideId,
    passengerId: data.passengerId,
    travelDate: rideInstance.date,
    rideDepartureTime: rideInstance.departureTime,
    rideArrivalTime: rideInstance.arrivalTime,
    seatNumber: data.seatNumber,
    departureStationId: data.departureStationId,
    arrivalStationId: data.arrivalStationId,
  }
}

export function toUpdateReservationDto(data: Partial<ReservationFormData>): UpdateReservationDto {
  return {
    passengerId: data.passengerId,
    seatNumber: data.seatNumber,
    departureStationId: data.departureStationId,
    arrivalStationId: data.arrivalStationId,
  }
}
