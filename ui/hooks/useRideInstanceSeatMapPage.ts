import { useEffect, useMemo, useState } from "react"
import { useSearchParams } from "next/navigation"
import ExcelJS from "exceljs"
import jsPDF from "jspdf"
import autoTable from "jspdf-autotable"
import { useRidesListQuery } from "@/infrastructure/hooks/queries/useRidesListQuery"
import { useRidesInstancesByDateQuery } from "@/infrastructure/hooks/queries/useRidesInstancesByDateQuery"
import { useReservationsByRideInstanceQuery } from "@/infrastructure/hooks/queries/useReservationsByRideInstanceQuery"
import { reservationsControllerList } from "@/infrastructure/generated/surp-api"
import { buildSeatMap } from "@/utils/seatHelpers"
import { buildReservationGroupLabels } from "@/utils/reservationGroupLabels"
import { registerPdfUnicodeFont } from "@/utils/pdfFonts"
import type { Reservation } from "@/types"

function normalizeDate(value: string): string {
  return value.includes("T") ? value.split("T")[0] : value
}

function formatLocalDate(value: string): string {
  const date = new Date(`${normalizeDate(value)}T00:00:00`)
  if (Number.isNaN(date.getTime())) {
    return value
  }
  const day = String(date.getDate()).padStart(2, "0")
  const month = String(date.getMonth() + 1).padStart(2, "0")
  return `${day}/${month}/${date.getFullYear()}`
}

const WEEKDAY_NAMES = [
  "NEDELJA",
  "PONEDELJAK",
  "UTORAK",
  "SREDA",
  "\u010cETVRTAK",
  "PETAK",
  "SUBOTA",
]

function formatWeekday(value: string): string {
  const date = new Date(`${normalizeDate(value)}T00:00:00`)
  if (Number.isNaN(date.getTime())) {
    return ""
  }
  return WEEKDAY_NAMES[date.getDay()]
}

/** Widest gap, in days, still treated as the other leg of the same round trip. */
const COUNTERPART_WINDOW_DAYS = 90

interface CounterpartLeg {
  /** "POV" when the other leg is still ahead, "ODL" when it already happened. */
  direction: "POV" | "ODL"
  date: string
}

/**
 * Looks up the other leg of a passenger's round trip.
 *
 * Legs are not linked in the database, so the counterpart is recognized by the
 * mirrored station pair on another ride; the closest one in time wins. A leg in
 * the past means the passenger is on the way back (ODL: departure date), a leg
 * in the future means a return ticket is still open (POV: return date).
 */
async function fetchCounterpartLegForPassenger(
  passengerId: string,
  currentReservationId: string,
  currentRideId: string,
  currentDate: string,
  currentDepartureStationId: string,
  currentArrivalStationId: string
): Promise<CounterpartLeg | null> {
  try {
    const response = await reservationsControllerList({
      passengerId,
      status: "ACTIVE",
      pageSize: 100,
    })
    if (response.status !== 200) {
      return null
    }
    const currentTime = new Date(`${normalizeDate(currentDate)}T00:00:00`).getTime()
    const candidates = response.data.items
      .filter(
        (item) =>
          item.id !== currentReservationId &&
          item.rideId !== currentRideId &&
          item.departureStationId === currentArrivalStationId &&
          item.arrivalStationId === currentDepartureStationId
      )
      .map((item) => {
        const itemTime = new Date(`${normalizeDate(item.travelDate)}T00:00:00`).getTime()
        return { item, dayGap: Math.round((itemTime - currentTime) / 86400000) }
      })
      .filter(({ dayGap }) => Math.abs(dayGap) <= COUNTERPART_WINDOW_DAYS)
      .sort((left, right) => Math.abs(left.dayGap) - Math.abs(right.dayGap))

    const closest = candidates[0]
    if (!closest) {
      return null
    }

    return {
      direction: closest.dayGap < 0 ? "ODL" : "POV",
      date: formatLocalDate(closest.item.travelDate),
    }
  } catch {
    return null
  }
}

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

  const groupLabelByGroupId = useMemo(() => {
    if (!selectedRideInstance) return new Map<string, string>()
    return buildReservationGroupLabels(
      reservations.filter(
        (reservation) =>
          reservation.rideInstanceId === selectedRideInstance.id && reservation.status === "active"
      )
    )
  }, [reservations, selectedRideInstance])

  useEffect(() => {
    const queryDate = searchParams?.get("date")
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

  const buildDefaultExportFileName = (): string => {
    if (!selectedRideInstance) return "putnici"
    const fromName = selectedRideInstance.ride.line.departureStation?.name ?? ""
    const toName = selectedRideInstance.ride.line.arrivalStation?.name ?? ""
    const dateStr = selectedRideInstance.date
    const timeStr = selectedRideInstance.departureTime
    return `${sanitizeFileNamePart(fromName)}-${sanitizeFileNamePart(toName)}-${dateStr}-${timeStr.replace(":", "-")}`
  }

  const handleExport = async (
    options: { fileName: string; format: "xlsx" | "pdf" } = {
      fileName: buildDefaultExportFileName(),
      format: "xlsx",
    }
  ) => {
    if (!selectedRideInstance) return

    const rideReservations = reservations
      .filter(
        (reservation) =>
          reservation.rideInstanceId === selectedRideInstance.id && reservation.status === "active"
      )
      .sort((left, right) => left.seatNumber - right.seatNumber)

    const dateStr = formatLocalDate(selectedRideInstance.date)
    const weekdayStr = formatWeekday(selectedRideInstance.date)
    const passengerCount = rideReservations.length
    const capacity = selectedRideInstance.ride.busCapacity
    const freeSeats = Math.max(capacity - passengerCount, 0)

    const headers = [
      "SED.",
      "GR",
      "PUTNIK",
      "POLAZAK",
      "DOLAZAK",
      "DATUM",
      "TELEFON",
      "INFO",
    ]

    const groupLabelByGroupId = buildReservationGroupLabels(rideReservations)

    const counterpartLegs = await Promise.all(
      rideReservations.map((reservation) =>
        fetchCounterpartLegForPassenger(
          reservation.passengerId,
          reservation.id,
          selectedRideInstance.ride.id,
          selectedRideInstance.date,
          reservation.departureStationId,
          reservation.arrivalStationId
        )
      )
    )

    const rows = rideReservations.map((reservation, index) => {
      const leg = counterpartLegs[index]
      return [
        String(reservation.seatNumber),
        reservation.groupId ? groupLabelByGroupId.get(reservation.groupId) ?? "" : "",
        `${reservation.passenger.firstName} ${reservation.passenger.lastName}`.trim().toUpperCase(),
        reservation.departureStation.name.toUpperCase(),
        reservation.arrivalStation.name.toUpperCase(),
        dateStr,
        reservation.passenger.phone ?? "",
        leg ? `${leg.direction}: ${leg.date}` : "1 SMER",
      ]
    })

    const safeBaseName = sanitizeFileNamePart(options.fileName) || buildDefaultExportFileName()
    const headingText = `LISTA: ${dateStr}${weekdayStr ? ` (${weekdayStr})` : ""} | PUTNIKA: ${passengerCount} | SLOBODNO: ${freeSeats}`

    if (options.format === "pdf") {
      const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" })
      await registerPdfUnicodeFont(doc)

      const margin = 8
      const headerFill: [number, number, number] = [26, 32, 51]
      const groupTextColor: [number, number, number] = [192, 0, 0]

      autoTable(doc, {
        startY: margin,
        margin: { left: margin, right: margin },
        head: [[{ content: headingText, colSpan: headers.length }], headers],
        body: rows,
        theme: "grid",
        styles: {
          font: "Roboto",
          fontStyle: "normal",
          fontSize: 8,
          cellPadding: { top: 1.2, bottom: 1.2, left: 1, right: 1 },
          textColor: [0, 0, 0],
          lineColor: [0, 0, 0],
          lineWidth: 0.2,
          halign: "center",
          valign: "middle",
          overflow: "ellipsize",
        },
        headStyles: {
          font: "Roboto",
          fontStyle: "bold",
          fillColor: headerFill,
          textColor: [255, 255, 255],
          halign: "center",
          valign: "middle",
          lineColor: [0, 0, 0],
          lineWidth: 0.2,
        },
        columnStyles: {
          0: { cellWidth: 12, fontStyle: "bold" },
          1: { cellWidth: 10, fontStyle: "bold", textColor: groupTextColor },
          2: { cellWidth: 42 },
          3: { cellWidth: 26 },
          4: { cellWidth: 26 },
          5: { cellWidth: 20 },
          6: { cellWidth: 30 },
          7: { cellWidth: 28 },
        },
        didParseCell: (data) => {
          if (data.section === "head" && data.row.index === 0) {
            data.cell.styles.fontSize = 11
          }
        },
      })
      doc.save(`${safeBaseName}.pdf`)
      return
    }

    const workbook = new ExcelJS.Workbook()
    const worksheet = workbook.addWorksheet("Putnici")

    const columnCount = headers.length
    const lastColumnLetter = worksheet.getColumn(columnCount).letter

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

    const groupRowFillArgb = "FFF3F4F6"
    rows.forEach((row, index) => {
      const addedRow = worksheet.addRow(row)
      const reservation = rideReservations[index]
      const hasGroup = Boolean(reservation.groupId)
      addedRow.eachCell((cell) => {
        cell.border = {
          top: { style: "thin" },
          left: { style: "thin" },
          bottom: { style: "thin" },
          right: { style: "thin" },
        }
        if (hasGroup) {
          cell.fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: groupRowFillArgb },
          }
        }
      })
    })

    worksheet.columns.forEach((column) => {
      let maxLength = 4
      column.eachCell?.({ includeEmpty: false }, (cell) => {
        const rowNumber = typeof cell.row === "number" ? cell.row : Number(cell.row)
        if (rowNumber <= 2) {
          return
        }
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
    const fileName = `${safeBaseName}.xlsx`
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
    groupLabelByGroupId,
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
    buildDefaultExportFileName,
    handleSingleReservationOpenChange,
    refetchReservations: reservationsQuery.refetch,
    setIsMultiReservationModalOpen,
  }
}
