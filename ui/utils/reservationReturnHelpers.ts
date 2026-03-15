import type { Reservation, ReservationFormData, RideInstance } from "@/types"
import { checkSeatConflict } from "@/utils/seatHelpers"

interface OrderedStation {
  stationId: string
  order: number
}

function getOrderedStations(instance: RideInstance): OrderedStation[] {
  const orderedIntermediate = [...instance.ride.line.intermediateStations].sort(
    (left, right) => left.order - right.order
  )

  return [
    { stationId: instance.ride.line.departureStation.id, order: 0 },
    ...orderedIntermediate.map((station, index) => ({
      stationId: station.stationId,
      order: index + 1,
    })),
    {
      stationId: instance.ride.line.arrivalStation.id,
      order: orderedIntermediate.length + 1,
    },
  ]
}

interface BuildReturnRequestsParams {
  outboundRequests: ReservationFormData[]
  returnInstance: RideInstance
  returnDepartureStationId: string
  returnArrivalStationId: string
  allReservations: Record<string, Reservation[]>
}

export function buildReturnRequests({
  outboundRequests,
  returnInstance,
  returnDepartureStationId,
  returnArrivalStationId,
  allReservations,
}: BuildReturnRequestsParams): ReservationFormData[] {
  const returnStations = getOrderedStations(returnInstance)

  const returnDepOrder = returnStations.find(
    (station) => station.stationId === returnDepartureStationId
  )?.order
  const returnArrOrder = returnStations.find(
    (station) => station.stationId === returnArrivalStationId
  )?.order

  if (returnDepOrder == null || returnArrOrder == null || returnArrOrder <= returnDepOrder) {
    throw new Error("Povratna vožnja ne podržava izabrane stanice.")
  }

  const existingReturnReservations = (allReservations[returnInstance.id] || []).filter(
    (reservation) => reservation.status === "active"
  )
  const workingReservations = [...existingReturnReservations]

  return outboundRequests.map((outboundRequest) => {
    const preferredSeat = outboundRequest.seatNumber
    const hasPreferredSeatConflict = checkSeatConflict(
      workingReservations,
      preferredSeat,
      returnDepartureStationId,
      returnArrivalStationId,
      returnStations
    )

    let assignedSeat = preferredSeat
    if (hasPreferredSeatConflict) {
      const firstAvailableSeat = Array.from(
        { length: returnInstance.ride.busCapacity },
        (_, index) => index + 1
      ).find(
        (seatNumber) =>
          !checkSeatConflict(
            workingReservations,
            seatNumber,
            returnDepartureStationId,
            returnArrivalStationId,
            returnStations
          )
      )

      if (!firstAvailableSeat) {
        throw new Error("Nema slobodnih sedišta za povratnu vožnju.")
      }

      assignedSeat = firstAvailableSeat
    }

    workingReservations.push({
      id: `planned-${outboundRequest.passengerId}-${assignedSeat}`,
      rideInstanceId: returnInstance.id,
      rideInstance: returnInstance,
      passengerId: outboundRequest.passengerId,
      passenger: {
        id: "",
        firstName: "",
        lastName: "",
        phone: "",
        passengerType: "odrasli",
      },
      seatNumber: assignedSeat,
      departureStationId: returnDepartureStationId,
      departureStation: { id: "", name: "", address: "" },
      arrivalStationId: returnArrivalStationId,
      arrivalStation: { id: "", name: "", address: "" },
      status: "active",
    })

    return {
      ...outboundRequest,
      rideInstanceId: returnInstance.id,
      departureStationId: returnDepartureStationId,
      arrivalStationId: returnArrivalStationId,
      seatNumber: assignedSeat,
    }
  })
}
