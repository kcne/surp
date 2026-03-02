import { SeatMapData, SeatInfo, Reservation } from "@/types"

// Build seat map from reservations
export const buildSeatMap = (
  reservations: Reservation[],
  capacity: number,
  selectedSeats: number[] = []
): SeatMapData => {
  const seats: SeatInfo[] = []
  const reservedSeatNumbers = new Set(
    reservations
      .filter((r) => r.status === "active")
      .map((r) => r.seatNumber)
  )
  const selectedSeatNumbers = new Set(selectedSeats)

  for (let i = 1; i <= capacity; i++) {
    const isReserved = reservedSeatNumbers.has(i)
    const isSelected = selectedSeatNumbers.has(i)
    const reservation = reservations.find(
      (r) => r.seatNumber === i && r.status === "active"
    )

    seats.push({
      seatNumber: i,
      status: isReserved ? "reserved" : isSelected ? "selected" : "available",
      reservation: reservation,
      isSelected,
    })
  }

  const availableCount = seats.filter((s) => s.status === "available").length
  const reservedCount = seats.filter((s) => s.status === "reserved").length

  return {
    seats,
    capacity,
    availableCount,
    reservedCount,
  }
}

// Check if seat has conflict for given route segment
export const checkSeatConflict = (
  reservations: Reservation[],
  seatNumber: number,
  departureStationId: string,
  arrivalStationId: string,
  lineStations: Array<{ stationId: string; order: number }>
): boolean => {
  // Get order of departure and arrival stations
  const depStation = lineStations.find((s) => s.stationId === departureStationId)
  const arrStation = lineStations.find((s) => s.stationId === arrivalStationId)

  if (!depStation || !arrStation) {
    return false
  }

  // Check all reservations for this seat
  const seatReservations = reservations.filter(
    (r) => r.seatNumber === seatNumber && r.status === "active"
  )

  for (const reservation of seatReservations) {
    const resDepStation = lineStations.find(
      (s) => s.stationId === reservation.departureStationId
    )
    const resArrStation = lineStations.find(
      (s) => s.stationId === reservation.arrivalStationId
    )

    if (!resDepStation || !resArrStation) {
      continue
    }

    // Check for overlap
    // Conflict if: new departure is between existing departure and arrival
    // OR new arrival is between existing departure and arrival
    // OR new route completely contains existing route
    const hasOverlap =
      (depStation.order >= resDepStation.order && depStation.order < resArrStation.order) ||
      (arrStation.order > resDepStation.order && arrStation.order <= resArrStation.order) ||
      (depStation.order <= resDepStation.order && arrStation.order >= resArrStation.order)

    if (hasOverlap) {
      return true
    }
  }

  return false
}

// Get seat status color
export const getSeatStatusColor = (status: SeatInfo["status"]): string => {
  switch (status) {
    case "available":
      return "border-green-500 bg-white hover:bg-green-50"
    case "reserved":
      return "border-red-500 bg-red-100 cursor-not-allowed"
    case "selected":
      return "border-blue-500 bg-blue-100"
    default:
      return "border-gray-300 bg-white"
  }
}









