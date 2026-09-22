import type {
  Passenger,
  PassengerFormData,
  Reservation,
  ReservationFormData,
  RideInstance,
} from "@/types"
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
  setPerSeatPassengers: (
    updater: (prev: Record<number, Passenger | null>) => Record<number, Passenger | null>
  ) => void
  addPassengerTargetSeat: number | null
  setAddPassengerTargetSeat: (seat: number | null) => void
  selectedRideInstance: RideInstance | null
  createReservation: (payload: {
    data: ReservationFormData
    rideInstance: RideInstance
  }) => Promise<Reservation>
  createReservationsBatch: (payload: {
    data: ReservationFormData[]
    rideInstance: RideInstance
    returnRideInstance?: RideInstance
    travelTogether?: boolean
  }) => Promise<Reservation[]>
  createReservationsForRideInstance: (
    instance: RideInstance,
    requests: ReservationFormData[],
    options?: { showSuccessToast?: boolean; travelTogether?: boolean }
  ) => Promise<Reservation[]>
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
  const createReturnLegs = async (
    returnInstance: RideInstance,
    linkedOutboundRequests: ReservationFormData[]
  ) => {
    const returnRequests = buildReturnRequests({
      outboundRequests: linkedOutboundRequests,
      returnInstance,
      returnDepartureStationId: form.getValues("arrivalStationId"),
      returnArrivalStationId: form.getValues("departureStationId"),
      allReservations,
    })

    try {
      await createReservationsForRideInstance(returnInstance, returnRequests, {
        showSuccessToast: false,
        travelTogether,
      })
    } catch (error) {
      toast.error(
        "Izmena polazne rezervacije je sacuvana, ali povratna nije rezervisana."
      )
      throw error
    }

    toast.success("Povratna karta je uspesno rezervisana")
  }

  const createWithOptionalReturn = async (outboundRequests: ReservationFormData[]) => {
    if (!selectedRideInstance) {
      throw new Error("Voznja nije izabrana")
    }

    if (isReturnTicket && !selectedReturnRideInstance) {
      throw new Error("Izaberite datum i vreme povratne voznje.")
    }

    if (isReturnTicket && selectedReturnRideInstance) {
      const returnRequests = buildReturnRequests({
        outboundRequests,
        returnInstance: selectedReturnRideInstance,
        returnDepartureStationId: form.getValues("arrivalStationId"),
        returnArrivalStationId: form.getValues("departureStationId"),
        allReservations,
      })
      await createReservationsBatch({
        data: [...outboundRequests, ...returnRequests],
        rideInstance: selectedRideInstance,
        returnRideInstance: selectedReturnRideInstance,
        travelTogether,
      })
      return
    }

    await (
      outboundRequests.length === 1 && !isMultiReservation
        ? createReservation({
              data: outboundRequests[0],
              rideInstance: selectedRideInstance,
            })
        : createReservationsBatch({
            data: outboundRequests,
            rideInstance: selectedRideInstance,
            travelTogether,
          })
    )
  }

  const onSubmit = async (data: ReservationFormData) => {
    try {
      if (isEdit && reservation) {
        await updateReservation(reservation.id, data)
        if (isReturnTicket && !existingReturnReservation) {
          if (!selectedReturnRideInstance) {
            throw new Error("Izaberite datum i vreme povratne voznje.")
          }

          // Adding a return leg to a saved reservation links it the same way a
          // fresh booking does; this path used to save neither side's link.
          await createReturnLegs(selectedReturnRideInstance, [
            { ...data, returnOfReservationId: reservation.id },
          ])
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
      const isStationsValid = await form.trigger(["departureStationId", "arrivalStationId"])

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
        form.setValue("passengerId", passenger.id, {
          shouldValidate: true,
          shouldDirty: true,
          shouldTouch: true,
        })
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
