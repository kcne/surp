import type { WouldBreakReservationsDto } from "@/infrastructure/generated/model"

/**
 * A change the server refused because it would break data that already exists —
 * lowering capacity under a seat that is sold, today.
 *
 * It is not an error in the sense the other ones are: the request was valid and
 * the agency may well mean it, a smaller bus really does get substituted. So it
 * carries the server's count up to the page, which asks the question and
 * resends with the confirmation, instead of being flattened into a red toast
 * that says only that something failed.
 */
export class ChangeNeedsConfirmationError extends Error {
  constructor(
    readonly confirmation: WouldBreakReservationsDto,
    /**
     * Which request in the edit was refused.
     *
     * An edit can be several requests — the ride, then each exception — and
     * each can be refused for its own reason. Confirming carries this key back
     * so only the request that was actually shown to somebody is confirmed;
     * a later one raises its own question instead of riding along on an answer
     * given about something else.
     */
    readonly step = "update",
    /**
     * True when an earlier request in the same edit already landed, so the
     * dialog can stop promising that cancelling leaves nothing behind.
     */
    readonly partiallyApplied = false
  ) {
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

export function throwBreakingChangeConflict(
  error: unknown,
  step = "update",
  partiallyApplied = false
): never {
  const confirmation = asBreakingChangeConflict(error)

  if (confirmation) {
    throw new ChangeNeedsConfirmationError(confirmation, step, partiallyApplied)
  }

  throw error
}
