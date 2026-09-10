import { reservationsControllerList } from "@/infrastructure/generated/surp-api"
import { buildReservationGroupLabels } from "@/utils/reservationGroupLabels"
import type { Reservation, RideInstance } from "@/types"

/**
 * The printed list the driver carries on the bus, as data.
 *
 * Both the PDF/Excel export and the on-screen passenger list are read side by
 * side with that sheet, so they share these columns and this row order rather
 * than each deriving their own.
 */
export const PASSENGER_LIST_HEADERS = [
  "SED.",
  "GR",
  "PUTNIK",
  "POLAZAK",
  "DOLAZAK",
  "DATUM",
  "TELEFON",
  "INFO",
] as const

export interface PassengerListRow {
  seatNumber: string
  groupLabel: string
  passengerName: string
  departureStation: string
  arrivalStation: string
  date: string
  phone: string
  info: string
  /** Set when the passenger shares a booking with someone else on this ride. */
  hasGroup: boolean
  notes: string | null
}

export function normalizeDate(value: string): string {
  return value.includes("T") ? value.split("T")[0] : value
}

export function formatLocalDate(value: string): string {
  const date = new Date(`${normalizeDate(value)}T00:00:00`)
  if (Number.isNaN(date.getTime())) {
    return value
  }
  const day = String(date.getDate()).padStart(2, "0")
  const month = String(date.getMonth() + 1).padStart(2, "0")
  return `${day}/${month}/${date.getFullYear()}`
}

const WEEKDAY_NAMES = [
  "NEDELJA",
  "PONEDELJAK",
  "UTORAK",
  "SREDA",
  "ČETVRTAK",
  "PETAK",
  "SUBOTA",
]

export function formatWeekday(value: string): string {
  const date = new Date(`${normalizeDate(value)}T00:00:00`)
  if (Number.isNaN(date.getTime())) {
    return ""
  }
  return WEEKDAY_NAMES[date.getDay()]
}

/** Widest gap, in days, still treated as the other leg of the same round trip. */
const COUNTERPART_WINDOW_DAYS = 90

interface CounterpartLeg {
  /** "POV" when the other leg is still ahead, "ODL" when it already happened. */
  direction: "POV" | "ODL"
  date: string
}

/**
 * Looks up the other leg of a passenger's round trip.
 *
 * Legs are not linked in the database, so the counterpart is recognized by the
 * mirrored station pair on another ride; the closest one in time wins. A leg in
 * the past means the passenger is on the way back (ODL: departure date), a leg
 * in the future means a return ticket is still open (POV: return date).
 */
async function fetchCounterpartLegForPassenger(
  passengerId: string,
  currentReservationId: string,
  currentRideId: string,
  currentDate: string,
  currentDepartureStationId: string,
  currentArrivalStationId: string
): Promise<CounterpartLeg | null> {
  try {
    const response = await reservationsControllerList({
      passengerId,
      status: "ACTIVE",
      pageSize: 100,
    })
    if (response.status !== 200) {
      return null
    }
    const currentTime = new Date(`${normalizeDate(currentDate)}T00:00:00`).getTime()
    const candidates = response.data.items
      .filter(
        (item) =>
          item.id !== currentReservationId &&
          item.rideId !== currentRideId &&
          item.departureStationId === currentArrivalStationId &&
          item.arrivalStationId === currentDepartureStationId
      )
      .map((item) => {
        const itemTime = new Date(`${normalizeDate(item.travelDate)}T00:00:00`).getTime()
        return { item, dayGap: Math.round((itemTime - currentTime) / 86400000) }
      })
      .filter(({ dayGap }) => Math.abs(dayGap) <= COUNTERPART_WINDOW_DAYS)
      .sort((left, right) => Math.abs(left.dayGap) - Math.abs(right.dayGap))

    const closest = candidates[0]
    if (!closest) {
      return null
    }

    return {
      direction: closest.dayGap < 0 ? "ODL" : "POV",
      date: formatLocalDate(closest.item.travelDate),
    }
  } catch {
    return null
  }
}

/** The active reservations of one ride instance, ordered by seat. */
export function selectRideInstancePassengers(
  reservations: Reservation[],
  rideInstance: RideInstance
): Reservation[] {
  return reservations
    .filter(
      (reservation) =>
        reservation.rideInstanceId === rideInstance.id && reservation.status === "active"
    )
    .sort((left, right) => left.seatNumber - right.seatNumber)
}

/**
 * The dark title row above the list: which day it is, how many passengers are
 * booked and how many seats are still open.
 */
export function buildPassengerListHeading(
  rideInstance: RideInstance,
  passengerCount: number
): string {
  const dateStr = formatLocalDate(rideInstance.date)
  const weekdayStr = formatWeekday(rideInstance.date)
  const freeSeats = Math.max(rideInstance.ride.busCapacity - passengerCount, 0)

  return `LISTA: ${dateStr}${weekdayStr ? ` (${weekdayStr})` : ""} | PUTNIKA: ${passengerCount} | SLOBODNO: ${freeSeats}`
}

/**
 * Turns the reservations of a ride instance into printable rows.
 *
 * The INFO column needs each passenger's other leg, which is one request per
 * passenger, so callers that only need the plain columns can skip it with
 * `includeCounterpartLegs: false`.
 */
export async function buildPassengerListRows(
  rideInstance: RideInstance,
  rideReservations: Reservation[],
  options: { includeCounterpartLegs?: boolean } = {}
): Promise<PassengerListRow[]> {
  const dateStr = formatLocalDate(rideInstance.date)
  const groupLabelByGroupId = buildReservationGroupLabels(rideReservations)

  const counterpartLegs = (options.includeCounterpartLegs ?? true)
    ? await Promise.all(
        rideReservations.map((reservation) =>
          fetchCounterpartLegForPassenger(
            reservation.passengerId,
            reservation.id,
            rideInstance.ride.id,
            rideInstance.date,
            reservation.departureStationId,
            reservation.arrivalStationId
          )
        )
      )
    : rideReservations.map(() => null)

  return rideReservations.map((reservation, index) => {
    const leg = counterpartLegs[index]

    return {
      seatNumber: String(reservation.seatNumber),
      groupLabel: reservation.groupId
        ? groupLabelByGroupId.get(reservation.groupId) ?? ""
        : "",
      passengerName: `${reservation.passenger.firstName} ${reservation.passenger.lastName}`
        .trim()
        .toUpperCase(),
      departureStation: reservation.departureStation.name.toUpperCase(),
      arrivalStation: reservation.arrivalStation.name.toUpperCase(),
      date: dateStr,
      phone: reservation.passenger.phone ?? "",
      info: leg ? `${leg.direction}: ${leg.date}` : "1 SMER",
      hasGroup: Boolean(reservation.groupId),
      notes: reservation.notes ?? null,
    }
  })
}

/** The row as the export writers consume it: one cell per header, in order. */
export function toPassengerListCells(row: PassengerListRow): string[] {
  return [
    row.seatNumber,
    row.groupLabel,
    row.passengerName,
    row.departureStation,
    row.arrivalStation,
    row.date,
    row.phone,
    row.info,
  ]
}
