import type { Passenger, PassengerFormData, Reservation, ReservationFormData, RideInstance } from "@/types"
import type { UseFormReturn } from "react-hook-form"
import { buildReturnRequests } from "@/utils/reservationReturnHelpers"
import { toast } from "sonner"

interface UseReservationSubmissionParams {
  form: UseFormReturn<ReservationFormData>
  isEdit: boolean
  reservation?: Reservation | null
  isReturnTicket: boolean
  selectedReturnRideInstance: RideInstance | undefined
  existingReturnReservation: Reservation | null
  isMultiReservation: boolean
  selectedSeats: number[]
  perSeatPassengers: Record<number, Passenger | null>
  perSeatNotes: Record<number, string>
  travelTogether: boolean
  allReservations: Record<string, Reservation[]>
  closeReservationModal: () => void
  onComplete?: () => void
  assignmentMode: "single" | "perSeat"
  setSelectedPassenger: (passenger: Passenger | null) => void
  setNewPassenger: (passenger: Passenger | null) => void
  setShowPassengerForm: (open: boolean) => void
  setPerSeatPassengers: (updater: (prev: Record<number, Passenger | null>) => Record<number, Passenger | null>) => void
  addPassengerTargetSeat: number | null
  setAddPassengerTargetSeat: (seat: number | null) => void
  selectedRideInstance: RideInstance | null
  createReservation: (payload: { data: ReservationFormData; rideInstance: RideInstance }) => Promise<void>
  createReservationsBatch: (payload: {
    data: ReservationFormData[]
    rideInstance: RideInstance
    travelTogether?: boolean
  }) => Promise<void>
  createReservationsForRideInstance: (
    instance: RideInstance,
    requests: ReservationFormData[],
    options?: { showSuccessToast?: boolean; travelTogether?: boolean }
  ) => Promise<void>
  updateReservation: (reservationId: string, data: ReservationFormData) => Promise<void>
  clearSelectedSeats: () => void
  createPassenger: (data: PassengerFormData) => Promise<Passenger>
}

export function useReservationSubmission({
  form,
  isEdit,
  reservation,
  isReturnTicket,
  selectedReturnRideInstance,
  existingReturnReservation,
  isMultiReservation,
  selectedSeats,
  perSeatPassengers,
  perSeatNotes,
  travelTogether,
  allReservations,
  closeReservationModal,
  onComplete,
  assignmentMode,
  setSelectedPassenger,
  setNewPassenger,
  setShowPassengerForm,
  setPerSeatPassengers,
  addPassengerTargetSeat,
  setAddPassengerTargetSeat,
  selectedRideInstance,
  createReservation,
  createReservationsBatch,
  createReservationsForRideInstance,
  updateReservation,
  clearSelectedSeats,
  createPassenger,
}: UseReservationSubmissionParams) {
  const createWithOptionalReturn = async (outboundRequests: ReservationFormData[]) => {
    if (!selectedRideInstance) {
      throw new Error("Voznja nije izabrana")
    }

    let returnRequests: ReservationFormData[] = []

    if (isReturnTicket) {
      if (!selectedReturnRideInstance) {
        throw new Error("Izaberite datum i vreme povratne vožnje.")
      }

      returnRequests = buildReturnRequests({
        outboundRequests,
        returnInstance: selectedReturnRideInstance,
        returnDepartureStationId: form.getValues("arrivalStationId"),
        returnArrivalStationId: form.getValues("departureStationId"),
        allReservations,
      })
    }

    if (outboundRequests.length === 1 && !isMultiReservation) {
      await createReservation({
        data: outboundRequests[0],
        rideInstance: selectedRideInstance,
      })
    } else {
      await createReservationsBatch({
        data: outboundRequests,
        rideInstance: selectedRideInstance,
        travelTogether,
      })
    }

    if (returnRequests.length > 0 && selectedReturnRideInstance) {
      await createReservationsForRideInstance(selectedReturnRideInstance, returnRequests, {
        showSuccessToast: false,
        travelTogether,
      })
      toast.success("Povratna karta je uspešno rezervisana")
    }
  }

  const onSubmit = async (data: ReservationFormData) => {
    try {
      if (isEdit && reservation) {
        await updateReservation(reservation.id, data)
        if (isReturnTicket && !existingReturnReservation) {
          if (!selectedReturnRideInstance) {
            throw new Error("Izaberite datum i vreme povratne vožnje.")
          }

          const returnRequests = buildReturnRequests({
            outboundRequests: [data],
            returnInstance: selectedReturnRideInstance,
            returnDepartureStationId: form.getValues("arrivalStationId"),
            returnArrivalStationId: form.getValues("departureStationId"),
            allReservations,
          })
          await createReservationsForRideInstance(selectedReturnRideInstance, returnRequests, {
            showSuccessToast: false,
          })
          toast.success("Povratna karta je uspešno rezervisana")
        }
      } else if (isMultiReservation) {
        const requests = selectedSeats.map((seat) => ({
          ...data,
          seatNumber: seat,
        }))
        await createWithOptionalReturn(requests)
        clearSelectedSeats()
        onComplete?.()
        return
      } else {
        await createWithOptionalReturn([data])
      }

      closeReservationModal()
    } catch (error) {
      if (error instanceof Error) {
        toast.error(error.message)
      }
    }
  }

  const handlePerSeatSubmit = async () => {
    try {
      const isStationsValid = await form.trigger([
        "departureStationId",
        "arrivalStationId",
      ])

      if (!isStationsValid) {
        return
      }

      const sharedValues = form.getValues()

      const perSeatRequests = selectedSeats.map((seat) => {
        const passenger = perSeatPassengers[seat]
        if (!passenger) {
          throw new Error(`Putnik nije izabran za sedište ${seat}`)
        }

        const seatNotes = perSeatNotes[seat]?.trim()
        return {
          ...sharedValues,
          seatNumber: seat,
          passengerId: passenger.id,
          notes: seatNotes ? seatNotes : undefined,
        }
      })

      await createWithOptionalReturn(perSeatRequests)
      clearSelectedSeats()
      onComplete?.()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Greška pri kreiranju rezervacija")
    }
  }

  const handleAddNewPassenger = async (passengerData: PassengerFormData) => {
    try {
      const passenger = await createPassenger(passengerData)

      if (assignmentMode === "single") {
        setSelectedPassenger(passenger)
        form.setValue("passengerId", passenger.id)
        setNewPassenger(passenger)
      } else if (assignmentMode === "perSeat" && addPassengerTargetSeat != null) {
        setPerSeatPassengers((prev) => ({ ...prev, [addPassengerTargetSeat]: passenger }))
      }

      setAddPassengerTargetSeat(null)
      setShowPassengerForm(false)
    } catch (error) {
      throw error
    }
  }

  return {
    onSubmit,
    handlePerSeatSubmit,
    handleAddNewPassenger,
  }
}
