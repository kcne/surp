interface SeatedReservationLike {
  seatNumber: number
  groupId?: string | null
}

/**
 * Builds a stable map from internal groupId to a short driver-friendly label
 * ("G1", "G2", ...) by encountering groups in seat-number order.
 *
 * Used by both the seat-map UI (badge next to seat number) and the driver
 * export so users see the same labels everywhere within a ride instance.
 */
export function buildReservationGroupLabels(
  reservations: SeatedReservationLike[]
): Map<string, string> {
  const labels = new Map<string, string>()
  const ordered = [...reservations].sort((a, b) => a.seatNumber - b.seatNumber)
  for (const reservation of ordered) {
    const id = reservation.groupId
    if (id && !labels.has(id)) {
      labels.set(id, `G${labels.size + 1}`)
    }
  }
  return labels
}
