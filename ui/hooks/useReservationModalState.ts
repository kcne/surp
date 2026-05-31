import { useEffect, useRef, useState } from "react"
import type { Passenger, Reservation, ReservationFormData, RideInstance } from "@/types"
import type { UseFormReturn } from "react-hook-form"

interface UseReservationModalStateParams {
  open: boolean
  onOpenChange: (open: boolean) => void
  seatNumber: number | null
  reservation?: Reservation | null
  selectedSeats: number[]
  showAssignmentMode: boolean
  selectedRideInstance: RideInstance | null
  form: UseFormReturn<ReservationFormData>
}

export function useReservationModalState({
  open,
  onOpenChange,
  seatNumber,
  reservation,
  selectedSeats,
  showAssignmentMode,
  selectedRideInstance,
  form,
}: UseReservationModalStateParams) {
  const lastInitKeyRef = useRef<string | null>(null)
  const [selectedPassenger, setSelectedPassenger] = useState<Passenger | null>(null)
  const [showPassengerForm, setShowPassengerForm] = useState(false)
  const [newPassenger, setNewPassenger] = useState<Passenger | null>(null)
  const [assignmentMode, setAssignmentMode] = useState<"single" | "perSeat">("single")
  const [perSeatPassengers, setPerSeatPassengers] = useState<Record<number, Passenger | null>>({})
  const [addPassengerTargetSeat, setAddPassengerTargetSeat] = useState<number | null>(null)
  const [isReturnTicket, setIsReturnTicket] = useState(false)
  const [returnDatePickerOpen, setReturnDatePickerOpen] = useState(false)
  const [selectedReturnDate, setSelectedReturnDate] = useState<Date | undefined>(undefined)
  const [selectedReturnRideInstanceId, setSelectedReturnRideInstanceId] = useState("")
  const [existingReturnReservation, setExistingReturnReservation] = useState<Reservation | null>(null)

  const fallbackSeatNumber = selectedSeats[0] || seatNumber || 1
  const defaultDepartureStationId = selectedRideInstance?.ride.line.departureStation.id || ""
  const defaultArrivalStationId = selectedRideInstance?.ride.line.arrivalStation.id || ""
  const { reset, setValue } = form

  const resetReservationFormState = () => {
    form.reset()
    setSelectedPassenger(null)
    setNewPassenger(null)
    setShowPassengerForm(false)
    setAssignmentMode("single")
    setPerSeatPassengers({})
    setAddPassengerTargetSeat(null)
    setIsReturnTicket(false)
    setSelectedReturnDate(undefined)
    setSelectedReturnRideInstanceId("")
    setExistingReturnReservation(null)
  }

  const closeReservationModal = () => {
    resetReservationFormState()
    onOpenChange(false)
  }

  const handleDialogOpenChange = (isOpen: boolean) => {
    if (!isOpen && showPassengerForm) {
      return
    }

    if (!isOpen) {
      resetReservationFormState()
    }

    onOpenChange(isOpen)
  }

  useEffect(() => {
    if (!open) {
      lastInitKeyRef.current = null
      return
    }

    const initKey = reservation
      ? `edit:${reservation.id}:${reservation.status}:${seatNumber ?? ""}`
      : `create:${selectedRideInstance?.id ?? ""}:${fallbackSeatNumber}:${defaultDepartureStationId}:${defaultArrivalStationId}`

    if (lastInitKeyRef.current === initKey) {
      return
    }

    lastInitKeyRef.current = initKey

    if (selectedRideInstance) {
      setValue("rideInstanceId", selectedRideInstance.id)
    }

    if (seatNumber) {
      setValue("seatNumber", seatNumber)
    }

    if (reservation) {
      reset({
        rideInstanceId: reservation.rideInstanceId,
        passengerId: reservation.passengerId,
        seatNumber: reservation.seatNumber,
        departureStationId: reservation.departureStationId,
        arrivalStationId: reservation.arrivalStationId,
        status: reservation.status,
      })
      setSelectedPassenger(reservation.passenger)
      setShowPassengerForm(false)
      setIsReturnTicket(false)
      setSelectedReturnDate(undefined)
      setSelectedReturnRideInstanceId("")
      setExistingReturnReservation(null)
      return
    }

    reset({
      rideInstanceId: selectedRideInstance?.id || "",
      passengerId: "",
      seatNumber: fallbackSeatNumber,
      departureStationId: defaultDepartureStationId,
      arrivalStationId: defaultArrivalStationId,
    })
    setSelectedPassenger(null)
    setNewPassenger(null)
    setShowPassengerForm(false)
    setAssignmentMode("single")
    setPerSeatPassengers({})
    setAddPassengerTargetSeat(null)
    setIsReturnTicket(false)
    setSelectedReturnDate(undefined)
    setSelectedReturnRideInstanceId("")
    setExistingReturnReservation(null)
  }, [
    open,
    selectedRideInstance?.id,
    seatNumber,
    reservation?.id,
    reservation?.status,
    fallbackSeatNumber,
    defaultDepartureStationId,
    defaultArrivalStationId,
    reset,
    setValue,
  ])

  useEffect(() => {
    if (selectedPassenger) {
      setValue("passengerId", selectedPassenger.id)
    }
  }, [selectedPassenger, setValue])

  useEffect(() => {
    if (newPassenger && assignmentMode === "single") {
      setSelectedPassenger(newPassenger)
      setShowPassengerForm(false)
      setValue("passengerId", newPassenger.id)
    }
  }, [newPassenger, assignmentMode, setValue])

  useEffect(() => {
    if (!showAssignmentMode && assignmentMode !== "single") {
      setAssignmentMode("single")
    }
  }, [showAssignmentMode, assignmentMode])

  return {
    selectedPassenger,
    showPassengerForm,
    newPassenger,
    assignmentMode,
    perSeatPassengers,
    addPassengerTargetSeat,
    isReturnTicket,
    returnDatePickerOpen,
    selectedReturnDate,
    selectedReturnRideInstanceId,
    existingReturnReservation,
    setSelectedPassenger,
    setShowPassengerForm,
    setNewPassenger,
    setAssignmentMode,
    setPerSeatPassengers,
    setAddPassengerTargetSeat,
    setIsReturnTicket,
    setReturnDatePickerOpen,
    setSelectedReturnDate,
    setSelectedReturnRideInstanceId,
    setExistingReturnReservation,
    resetReservationFormState,
    closeReservationModal,
    handleDialogOpenChange,
  }
}
