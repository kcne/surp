import { useEffect } from "react"
import type { Reservation, RideInstance } from "@/types"
import { findReturnCounterpart } from "@/utils/reservationReturnMatching"

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

    const counterpart = findReturnCounterpart(
      reservation,
      returnRideInstances,
      allReservations
    )

    if (!counterpart) {
      setExistingReturnReservation(null)
      return
    }

    const { reservation: matched, rideInstance: matchedInstance } = counterpart

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

    if (selectedStillExists) return

    // A chosen bus that dropped out of the list, refused by the server and
    // refetched, stays chosen so the operator picks again (#27, PR 4b).
    // Moving to the next bus that day would book one they never chose.
    const selectedBusGone =
      selectedReturnRideInstanceId !== "" &&
      !returnRideInstances.some((instance) => instance.id === selectedReturnRideInstanceId)

    if (!selectedBusGone) {
      setSelectedReturnRideInstanceId(returnInstancesForSelectedDate[0]?.id || "")
    }
  }, [
    isReturnTicket,
    selectedReturnDateKey,
    selectedReturnRideInstanceId,
    returnInstancesForSelectedDate,
    returnRideInstances,
    setSelectedReturnRideInstanceId,
  ])
}
