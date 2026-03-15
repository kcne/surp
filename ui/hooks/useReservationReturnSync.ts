import { useEffect } from "react"
import type { Reservation, RideInstance } from "@/types"

interface UseReservationReturnSyncParams {
  open: boolean
  reservation?: Reservation | null
  returnRideInstances: RideInstance[]
  allReservations: Record<string, Reservation[]>
  existingReturnReservation: Reservation | null
  isReturnTicket: boolean
  selectedReturnDate?: Date
  selectedReturnDateKey: string
  selectedReturnRideInstanceId: string
  returnInstancesForSelectedDate: RideInstance[]
  setExistingReturnReservation: (reservation: Reservation | null) => void
  setIsReturnTicket: (value: boolean) => void
  setSelectedReturnRideInstanceId: (id: string) => void
  setSelectedReturnDate: (date: Date | undefined) => void
}

export function useReservationReturnSync({
  open,
  reservation,
  returnRideInstances,
  allReservations,
  existingReturnReservation,
  isReturnTicket,
  selectedReturnDate,
  selectedReturnDateKey,
  selectedReturnRideInstanceId,
  returnInstancesForSelectedDate,
  setExistingReturnReservation,
  setIsReturnTicket,
  setSelectedReturnRideInstanceId,
  setSelectedReturnDate,
}: UseReservationReturnSyncParams) {
  useEffect(() => {
    if (!open || !reservation || returnRideInstances.length === 0) {
      return
    }

    const returnInstanceById = new Map(
      returnRideInstances.map((instance) => [instance.id, instance])
    )

    const candidates = Object.entries(allReservations)
      .flatMap(([instanceId, reservationsForInstance]) => {
        if (!returnInstanceById.has(instanceId)) {
          return []
        }
        return reservationsForInstance
      })
      .filter((candidate) => {
        if (candidate.status !== "active") return false
        if (candidate.passengerId !== reservation.passengerId) return false
        if (candidate.departureStationId !== reservation.arrivalStationId) return false
        if (candidate.arrivalStationId !== reservation.departureStationId) return false
        return true
      })
      .sort((left, right) => {
        const leftSeatScore = left.seatNumber === reservation.seatNumber ? 0 : 1
        const rightSeatScore = right.seatNumber === reservation.seatNumber ? 0 : 1
        if (leftSeatScore !== rightSeatScore) {
          return leftSeatScore - rightSeatScore
        }

        const leftInstance = returnInstanceById.get(left.rideInstanceId)
        const rightInstance = returnInstanceById.get(right.rideInstanceId)

        const leftDateTime = leftInstance
          ? `${leftInstance.date}T${leftInstance.departureTime}`
          : ""
        const rightDateTime = rightInstance
          ? `${rightInstance.date}T${rightInstance.departureTime}`
          : ""

        return leftDateTime.localeCompare(rightDateTime)
      })

    const matched = candidates[0]

    if (!matched) {
      setExistingReturnReservation(null)
      return
    }

    const matchedInstance = returnInstanceById.get(matched.rideInstanceId)
    if (!matchedInstance) {
      setExistingReturnReservation(null)
      return
    }

    if (existingReturnReservation?.id !== matched.id) {
      setExistingReturnReservation(matched)
    }

    if (!isReturnTicket) {
      setIsReturnTicket(true)
    }

    if (selectedReturnRideInstanceId !== matchedInstance.id) {
      setSelectedReturnRideInstanceId(matchedInstance.id)
    }

    if (selectedReturnDateKey !== matchedInstance.date) {
      setSelectedReturnDate(new Date(`${matchedInstance.date}T00:00:00`))
    }
  }, [
    open,
    reservation,
    returnRideInstances,
    allReservations,
    existingReturnReservation,
    isReturnTicket,
    selectedReturnDateKey,
    selectedReturnRideInstanceId,
    setExistingReturnReservation,
    setIsReturnTicket,
    setSelectedReturnDate,
    setSelectedReturnRideInstanceId,
  ])

  useEffect(() => {
    if (!isReturnTicket) {
      setSelectedReturnDate(undefined)
      setSelectedReturnRideInstanceId("")
      return
    }

    if (!selectedReturnDate && returnRideInstances.length > 0) {
      const first = returnRideInstances[0]
      setSelectedReturnDate(new Date(`${first.date}T00:00:00`))
      setSelectedReturnRideInstanceId(first.id)
    }
  }, [
    isReturnTicket,
    returnRideInstances,
    selectedReturnDate,
    setSelectedReturnDate,
    setSelectedReturnRideInstanceId,
  ])

  useEffect(() => {
    if (!isReturnTicket || !selectedReturnDateKey) return

    const selectedStillExists = returnInstancesForSelectedDate.some(
      (instance) => instance.id === selectedReturnRideInstanceId
    )

    if (!selectedStillExists) {
      setSelectedReturnRideInstanceId(returnInstancesForSelectedDate[0]?.id || "")
    }
  }, [
    isReturnTicket,
    selectedReturnDateKey,
    selectedReturnRideInstanceId,
    returnInstancesForSelectedDate,
    setSelectedReturnRideInstanceId,
  ])
}
