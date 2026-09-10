import { useEffect, useMemo, useState } from "react"
import { useSearchParams } from "next/navigation"
import ExcelJS from "exceljs"
import jsPDF from "jspdf"
import autoTable from "jspdf-autotable"
import { useRidesListQuery } from "@/infrastructure/hooks/queries/useRidesListQuery"
import { useRidesInstancesByDateQuery } from "@/infrastructure/hooks/queries/useRidesInstancesByDateQuery"
import { useReservationsByRideInstanceQuery } from "@/infrastructure/hooks/queries/useReservationsByRideInstanceQuery"
import { buildSeatMap } from "@/utils/seatHelpers"
import { buildReservationGroupLabels } from "@/utils/reservationGroupLabels"
import {
  PASSENGER_LIST_HEADERS,
  buildPassengerListHeading,
  buildPassengerListRows,
  selectRideInstancePassengers,
  toPassengerListCells,
} from "@/utils/passengerListHelpers"
import { registerPdfUnicodeFont } from "@/utils/pdfFonts"
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

    const rideReservations = selectRideInstancePassengers(reservations, selectedRideInstance)
    const headers = [...PASSENGER_LIST_HEADERS]
    const listRows = await buildPassengerListRows(selectedRideInstance, rideReservations)
    const rows = listRows.map(toPassengerListCells)

    const safeBaseName = sanitizeFileNamePart(options.fileName) || buildDefaultExportFileName()
    const headingText = buildPassengerListHeading(selectedRideInstance, rideReservations.length)

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
      const hasGroup = listRows[index].hasGroup
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
