import type { Reservation } from "@/types"
import { passengerIdentity, samePassenger, type PassengerIdentity } from "./passengerMatching"
import type { ImportRow } from "./types"

export type ImportDuplicateKind = "existing" | "file"

export interface ImportDuplicateInfo {
  kind: ImportDuplicateKind
  message: string
  /** Reservation already in the system, set for `existing`. */
  reservationId?: string
  /** Earlier row of this same import, set for `file`. */
  rowId?: string
}

export interface DuplicateDetectionContext {
  /** Reservations already in the system, keyed by ride instance id. */
  reservationsByRideInstanceId: Record<string, Reservation[]>
}

interface ReservationIdentity extends PassengerIdentity {
  reservationId: string
  seatNumber: number
}

interface RowIdentity extends PassengerIdentity {
  rowId: string
  lineNumber: number
}

function indexReservations(
  reservationsByRideInstanceId: Record<string, Reservation[]>
): Map<string, ReservationIdentity[]> {
  const index = new Map<string, ReservationIdentity[]>()

  Object.entries(reservationsByRideInstanceId).forEach(([rideInstanceId, reservations]) => {
    const identities = reservations
      .filter((reservation) => reservation.status === "active")
      .map((reservation) => ({
        ...passengerIdentity(
          reservation.passenger.firstName,
          reservation.passenger.lastName,
          reservation.passenger.phone,
          reservation.passengerId
        ),
        reservationId: reservation.id,
        seatNumber: reservation.seatNumber,
      }))

    index.set(rideInstanceId, identities)
  })

  return index
}

/**
 * Marks rows that would re-create a reservation the system already has, and
 * rows that repeat an earlier row of the same file. A row repeats a trip when
 * it puts the same passenger on the same ride instance; the seat and the
 * segment stay out of the comparison, because a second booking of the same
 * person on the same ride is a duplicate whichever seat the sheet names.
 *
 * Detection deliberately ignores `excluded`, so that excluding a row does not
 * turn the rows repeating it back into originals.
 */
export function findDuplicateRows(
  rows: ImportRow[],
  { reservationsByRideInstanceId }: DuplicateDetectionContext
): Map<string, ImportDuplicateInfo> {
  const reservationIndex = indexReservations(reservationsByRideInstanceId)
  const seenByRideInstanceId = new Map<string, RowIdentity[]>()
  const duplicates = new Map<string, ImportDuplicateInfo>()

  rows.forEach((row) => {
    if (!row.rideInstanceId) {
      return
    }

    const identity = passengerIdentity(row.firstName, row.lastName, row.phone, row.passengerId)

    // Without a usable name there is nothing to compare on, and guessing would
    // exclude rows the operator has not finished filling in yet.
    if (identity.nameKey.length === 0) {
      return
    }

    const existing = (reservationIndex.get(row.rideInstanceId) ?? []).find((reservation) =>
      samePassenger(identity, reservation)
    )

    if (existing) {
      duplicates.set(row.id, {
        kind: "existing",
        message: `Rezervacija za ovog putnika vec postoji na ovoj voznji (sediste ${existing.seatNumber})`,
        reservationId: existing.reservationId,
      })
      return
    }

    const seen = seenByRideInstanceId.get(row.rideInstanceId) ?? []
    const earlier = seen.find((candidate) => samePassenger(identity, candidate))

    if (earlier) {
      duplicates.set(row.id, {
        kind: "file",
        message: `Isti putnik je vec u redu ${earlier.lineNumber} ovog fajla, na istoj voznji`,
        rowId: earlier.rowId,
      })
      return
    }

    seenByRideInstanceId.set(row.rideInstanceId, [
      ...seen,
      { ...identity, rowId: row.id, lineNumber: row.source.lineNumber },
    ])
  })

  return duplicates
}
