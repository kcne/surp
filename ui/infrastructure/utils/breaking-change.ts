import type { WouldBreakReservationsDto } from "@/infrastructure/generated/model"

export class ChangeNeedsConfirmationError extends Error {
  constructor(readonly confirmation: WouldBreakReservationsDto) {
    super(confirmation.message)
    this.name = "ChangeNeedsConfirmationError"
  }
}

export function asBreakingChangeConflict(error: unknown): WouldBreakReservationsDto | null {
  const response = (error as { response?: { status?: number; data?: unknown } })?.response

  if (response?.status !== 409) {
    return null
  }

  const data = response.data as Partial<WouldBreakReservationsDto> | undefined

  if (
    data?.code !== "WOULD_BREAK_RESERVATIONS" ||
    typeof data.affectedCount !== "number" ||
    typeof data.invariant !== "string" ||
    typeof data.message !== "string"
  ) {
    return null
  }

  return data as WouldBreakReservationsDto
}

export function throwBreakingChangeConflict(error: unknown): never {
  const confirmation = asBreakingChangeConflict(error)

  if (confirmation) {
    throw new ChangeNeedsConfirmationError(confirmation)
  }

  throw error
}
