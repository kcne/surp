import { useEffect, useMemo, useState } from "react"
import { useRidesStore } from "@/stores/ridesStore"
import { useReservationsStore } from "@/stores/reservationsStore"
import type { Reservation } from "@/types"

interface UseRideInstanceSeatMapPageParams {
  rideInstanceId: string
}

const CSV_BOM = "\uFEFF"

export function useRideInstanceSeatMapPage({ rideInstanceId }: UseRideInstanceSeatMapPageParams) {
  const { rideInstances, fetchRideInstances, selectedDate } = useRidesStore()
  const {
    seatMap,
    reservations,
    selectedSeat,
    selectedSeats,
    selectedRideInstance,
    setSelectedRideInstance,
    fetchReservations,
    loading,
    toggleSelectedSeat,
    clearSelectedSeats,
    setSelectedSeat,
  } = useReservationsStore()

  const [isReservationModalOpen, setIsReservationModalOpen] = useState(false)
  const [isMultiReservationModalOpen, setIsMultiReservationModalOpen] = useState(false)
  const [reservationToEdit, setReservationToEdit] = useState<Reservation | null>(null)

  useEffect(() => {
    if (selectedDate) {
      fetchRideInstances(selectedDate)
    }
  }, [selectedDate, fetchRideInstances])

  useEffect(() => {
    const instance = rideInstances.find((rideInstance) => rideInstance.id === rideInstanceId)
    if (instance && selectedRideInstance?.id !== instance.id) {
      setSelectedRideInstance(instance)
    }
  }, [rideInstanceId, rideInstances, selectedRideInstance?.id, setSelectedRideInstance])

  useEffect(() => {
    if (selectedRideInstance && selectedRideInstance.id === rideInstanceId) {
      fetchReservations(selectedRideInstance.id)
    }
  }, [selectedRideInstance, rideInstanceId, fetchReservations])

  const handleSeatClick = (seatNumber: number, reservation?: Reservation) => {
    if (reservation) {
      setReservationToEdit(reservation)
      setSelectedSeat(seatNumber)
      setIsReservationModalOpen(true)
      return
    }

    toggleSelectedSeat(seatNumber)
  }

  const handleExport = () => {
    if (!selectedRideInstance) return

    const rideReservations = reservations
      .filter(
        (reservation) =>
          reservation.rideInstanceId === selectedRideInstance.id && reservation.status === "active"
      )
      .sort((left, right) => left.seatNumber - right.seatNumber)

    const escapeCsv = (value: string | number | undefined) => {
      const stringValue = String(value ?? "")
      if (stringValue.includes(",") || stringValue.includes("\"") || stringValue.includes("\n")) {
        return `"${stringValue.replace(/"/g, '""')}"`
      }
      return stringValue
    }

    const headers = [
      "Sedište",
      "Ime",
      "Prezime",
      "Telefon",
      "Email",
      "Tip putnika",
      "Polazna stanica",
      "Dolazna stanica",
      "Datum polaska",
      "Vreme polaska",
    ]

    const rows = rideReservations.map((reservation) => [
      reservation.seatNumber,
      reservation.passenger.firstName,
      reservation.passenger.lastName,
      reservation.passenger.phone,
      reservation.passenger.email || "",
      reservation.passenger.passengerType,
      reservation.departureStation.name,
      reservation.arrivalStation.name,
      selectedRideInstance.date,
      selectedRideInstance.departureTime,
    ])

    const csvContent = CSV_BOM + [headers, ...rows].map((row) => row.map(escapeCsv).join(",")).join("\n")

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement("a")
    anchor.href = url
    anchor.download = `putnici-${selectedRideInstance.id}.csv`
    document.body.appendChild(anchor)
    anchor.click()
    document.body.removeChild(anchor)
    URL.revokeObjectURL(url)
  }

  const routeName = selectedRideInstance?.ride.line.name ?? ""
  const reservedCount = seatMap?.reservedCount || 0
  const totalSeats = seatMap?.capacity || selectedRideInstance?.ride.busCapacity || 0

  const localizedRideDate = useMemo(() => {
    if (!selectedRideInstance) return ""

    return new Date(selectedRideInstance.date).toLocaleDateString("sr-Latn-RS", {
      day: "numeric",
      month: "long",
      year: "numeric",
    })
  }, [selectedRideInstance])

  const handleSingleReservationOpenChange = (open: boolean) => {
    setIsReservationModalOpen(open)
    if (!open) {
      setReservationToEdit(null)
    }
  }

  return {
    selectedDate,
    seatMap,
    loading,
    selectedSeat,
    selectedSeats,
    selectedRideInstance,
    reservationToEdit,
    isReservationModalOpen,
    isMultiReservationModalOpen,
    routeName,
    reservedCount,
    totalSeats,
    localizedRideDate,
    clearSelectedSeats,
    handleSeatClick,
    handleExport,
    handleSingleReservationOpenChange,
    setIsMultiReservationModalOpen,
  }
}
