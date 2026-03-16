import type {
  CreatePassengerDto,
  PassengerResponseDto,
  UpdatePassengerDto,
} from "@/infrastructure/generated/model"
import type { Passenger, PassengerFormData } from "@/types"

function toUiPassengerType(type: PassengerResponseDto["passengerType"]): Passenger["passengerType"] {
  switch (type) {
    case "CHILD":
      return "dete"
    case "STUDENT":
      return "student"
    case "SENIOR":
      return "penzioner"
    case "ADULT":
    default:
      return "odrasli"
  }
}

function toApiPassengerType(
  type: PassengerFormData["passengerType"] | undefined
): CreatePassengerDto["passengerType"] | UpdatePassengerDto["passengerType"] | undefined {
  switch (type) {
    case "dete":
      return "CHILD"
    case "student":
      return "STUDENT"
    case "penzioner":
      return "SENIOR"
    case "odrasli":
      return "ADULT"
    default:
      return undefined
  }
}

function optionalString(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined
  }

  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : undefined
}

export function toPassenger(dto: PassengerResponseDto): Passenger {
  return {
    id: dto.id,
    firstName: dto.firstName,
    lastName: dto.lastName,
    phone: dto.phone,
    email: optionalString(dto.email ?? undefined),
    passengerType: toUiPassengerType(dto.passengerType),
    notes: optionalString(dto.notes ?? undefined),
    createdAt: dto.createdAt,
    updatedAt: dto.updatedAt,
  }
}

export function toCreatePassengerDto(data: PassengerFormData): CreatePassengerDto {
  return {
    firstName: data.firstName.trim(),
    lastName: data.lastName.trim(),
    phone: data.phone.trim(),
    email: optionalString(data.email),
    passengerType: toApiPassengerType(data.passengerType),
    notes: optionalString(data.notes),
    isActive: true,
  }
}

export function toUpdatePassengerDto(data: Partial<PassengerFormData>): UpdatePassengerDto {
  return {
    firstName: data.firstName?.trim(),
    lastName: data.lastName?.trim(),
    phone: data.phone?.trim(),
    email: optionalString(data.email),
    passengerType: toApiPassengerType(data.passengerType),
    notes: optionalString(data.notes),
  }
}
