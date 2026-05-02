import { useEffect, useMemo, useState } from "react"
import { useSearchParams } from "next/navigation"
import ExcelJS from "exceljs"
import { useRidesListQuery } from "@/infrastructure/hooks/queries/useRidesListQuery"
import { useRidesInstancesByDateQuery } from "@/infrastructure/hooks/queries/useRidesInstancesByDateQuery"
import { useReservationsByRideInstanceQuery } from "@/infrastructure/hooks/queries/useReservationsByRideInstanceQuery"
import { buildSeatMap } from "@/utils/seatHelpers"
import type { Reservation } from "@/types"

interface UseRideInstanceSeatMapPageParams {
  rideInstanceId: string
}

function sanitizeFileNamePart(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[^\w\s.-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
}

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

  const handleExport = async () => {
    if (!selectedRideInstance) return

    const rideReservations = reservations
      .filter(
        (reservation) =>
          reservation.rideInstanceId === selectedRideInstance.id && reservation.status === "active"
      )
      .sort((left, right) => left.seatNumber - right.seatNumber)

    const fromName = selectedRideInstance.ride.line.departureStation?.name ?? ""
    const toName = selectedRideInstance.ride.line.arrivalStation?.name ?? ""
    const dateStr = selectedRideInstance.date
    const timeStr = selectedRideInstance.departureTime
    const passengerCount = rideReservations.length

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

    const workbook = new ExcelJS.Workbook()
    const worksheet = workbook.addWorksheet("Putnici")

    const columnCount = headers.length
    const lastColumnLetter = worksheet.getColumn(columnCount).letter

    const headingText = `${fromName} - ${toName} - ${dateStr} - ${timeStr} - ${passengerCount}`
    worksheet.mergeCells(`A1:${lastColumnLetter}1`)
    const headingCell = worksheet.getCell("A1")
    headingCell.value = headingText
    headingCell.font = { bold: true, size: 14 }
    headingCell.alignment = { horizontal: "center", vertical: "middle" }
    worksheet.getRow(1).height = 24

    worksheet.addRow([])

    const headerRow = worksheet.addRow(headers)
    headerRow.font = { bold: true }
    headerRow.alignment = { horizontal: "center", vertical: "middle" }
    headerRow.eachCell((cell) => {
      cell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FFE5E7EB" },
      }
      cell.border = {
        top: { style: "thin" },
        left: { style: "thin" },
        bottom: { style: "thin" },
        right: { style: "thin" },
      }
    })

    rows.forEach((row) => {
      const addedRow = worksheet.addRow(row)
      addedRow.eachCell((cell) => {
        cell.border = {
          top: { style: "thin" },
          left: { style: "thin" },
          bottom: { style: "thin" },
          right: { style: "thin" },
        }
      })
    })

    worksheet.columns.forEach((column) => {
      let maxLength = 10
      column.eachCell?.({ includeEmpty: false }, (cell) => {
        const value = cell.value == null ? "" : String(cell.value)
        if (value.length > maxLength) {
          maxLength = value.length
        }
      })
      column.width = Math.min(maxLength + 2, 40)
    })

    const buffer = await workbook.xlsx.writeBuffer()
    const blob = new Blob([buffer], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement("a")
    anchor.href = url
    const fileName = `${sanitizeFileNamePart(fromName)}-${sanitizeFileNamePart(toName)}-${dateStr}-${timeStr.replace(":", "-")}.xlsx`
    anchor.download = fileName
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
    refetchReservations: reservationsQuery.refetch,
    setIsMultiReservationModalOpen,
  }
}
