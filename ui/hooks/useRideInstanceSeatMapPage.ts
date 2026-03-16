import { useEffect, useMemo, useState } from "react"
import { useSearchParams } from "next/navigation"
import { useRidesListQuery } from "@/infrastructure/hooks/queries/useRidesListQuery"
import { useRidesInstancesByDateQuery } from "@/infrastructure/hooks/queries/useRidesInstancesByDateQuery"
import { useReservationsByRideInstanceQuery } from "@/infrastructure/hooks/queries/useReservationsByRideInstanceQuery"
import { buildSeatMap } from "@/utils/seatHelpers"
import type { Reservation } from "@/types"

interface UseRideInstanceSeatMapPageParams {
  rideInstanceId: string
}

const CSV_BOM = "\uFEFF"

function extractDateFromRideInstanceId(rideInstanceId: string): Date | null {
  const parts = rideInstanceId.split(":")
  if (parts.length < 2) {
    return null
  }

  const parsed = new Date(`${parts[1]}T00:00:00`)
  if (Number.isNaN(parsed.getTime())) {
    return null
  }

  return parsed
}

export function useRideInstanceSeatMapPage({ rideInstanceId }: UseRideInstanceSeatMapPageParams) {
  const searchParams = useSearchParams()
  const [selectedDate, setSelectedDate] = useState<Date>(() => new Date())
  const [selectedSeat, setSelectedSeat] = useState<number | null>(null)
  const [selectedSeats, setSelectedSeats] = useState<number[]>([])
  const [isReservationModalOpen, setIsReservationModalOpen] = useState(false)
  const [isMultiReservationModalOpen, setIsMultiReservationModalOpen] = useState(false)
  const [reservationToEdit, setReservationToEdit] = useState<Reservation | null>(null)
  const ridesQuery = useRidesListQuery()
  const rides = ridesQuery.data || []
  const rideInstancesQuery = useRidesInstancesByDateQuery(selectedDate, rides)
  const rideInstances = useMemo(
    () => rideInstancesQuery.data ?? [],
    [rideInstancesQuery.data]
  )
  const selectedRideInstance = useMemo(
    () => rideInstances.find((rideInstance) => rideInstance.id === rideInstanceId) ?? null,
    [rideInstanceId, rideInstances]
  )
  const reservationsQuery = useReservationsByRideInstanceQuery(selectedRideInstance)
  const reservations = useMemo(
    () => reservationsQuery.data ?? [],
    [reservationsQuery.data]
  )

  const seatMap = useMemo(() => {
    if (!selectedRideInstance) {
      return null
    }

    return buildSeatMap(reservations, selectedRideInstance.ride.busCapacity, selectedSeats)
  }, [reservations, selectedRideInstance, selectedSeats])

  useEffect(() => {
    const queryDate = searchParams.get("date")
    if (queryDate) {
      const parsedFromQuery = new Date(`${queryDate}T00:00:00`)
      if (!Number.isNaN(parsedFromQuery.getTime())) {
        setSelectedDate(parsedFromQuery)
      }
      return
    }

    const parsedFromSlug = extractDateFromRideInstanceId(rideInstanceId)
    if (parsedFromSlug) {
      setSelectedDate(parsedFromSlug)
    }
  }, [rideInstanceId, searchParams, setSelectedDate])

  useEffect(() => {
    setSelectedSeat(null)
    setSelectedSeats([])
    setReservationToEdit(null)
  }, [rideInstanceId])

  const toggleSelectedSeat = (seatNumber: number) => {
    setSelectedSeats((previous) =>
      previous.includes(seatNumber)
        ? previous.filter((value) => value !== seatNumber)
        : [...previous, seatNumber]
    )
  }

  const clearSelectedSeats = () => {
    setSelectedSeats([])
    setSelectedSeat(null)
  }

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
    reservations,
    loading:
      reservationsQuery.isLoading ||
      reservationsQuery.isFetching ||
      ridesQuery.isLoading ||
      rideInstancesQuery.isLoading,
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
