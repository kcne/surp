import { useEffect, useMemo, useState } from "react"
import { useSearchParams } from "next/navigation"
import ExcelJS from "exceljs"
import { useRidesListQuery } from "@/infrastructure/hooks/queries/useRidesListQuery"
import { useDepartureQuery } from "@/infrastructure/hooks/queries/useDeparturesQuery"
import { toDepartureInstance } from "@/infrastructure/mappers/departureMappers"
import { useLegacyDepartureRedirect } from "@/hooks/useLegacyDepartureRedirect"
import { parseLegacyInstanceId } from "@/utils/legacyDepartureLinks"
import { useReservationsByRideInstanceQuery } from "@/infrastructure/hooks/queries/useReservationsByRideInstanceQuery"
import { useMoveReservationSeatMutation } from "@/infrastructure/hooks/mutations/useReservationMutations"
import { buildSeatMap } from "@/utils/seatHelpers"
import { buildReservationGroupLabels } from "@/utils/reservationGroupLabels"
import {
  PASSENGER_LIST_HEADERS,
  buildPassengerListHeading,
  buildPassengerListRows,
  selectRideInstancePassengers,
  toPassengerListCells,
} from "@/utils/passengerListHelpers"
import { createPassengerListPdf } from "@/utils/passengerListPdf"
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

export function useRideInstanceSeatMapPage({ rideInstanceId }: UseRideInstanceSeatMapPageParams) {
  const searchParams = useSearchParams()
  const [selectedDate, setSelectedDate] = useState<Date>(() => new Date())
  const [selectedSeat, setSelectedSeat] = useState<number | null>(null)
  const [selectedSeats, setSelectedSeats] = useState<number[]>([])
  const [isReservationModalOpen, setIsReservationModalOpen] = useState(false)
  const [isMultiReservationModalOpen, setIsMultiReservationModalOpen] = useState(false)
  const [reservationToEdit, setReservationToEdit] = useState<Reservation | null>(null)
  const [isBulkCancelOpen, setIsBulkCancelOpen] = useState(false)
  const ridesQuery = useRidesListQuery()
  const rides = useMemo(() => ridesQuery.data ?? [], [ridesQuery.data])
  // The page is keyed by departureId (#27, PR 4a). An old link names the bus
  // by ride, date and time, and is replaced with the departure it meant.
  const legacyLink = useMemo(() => parseLegacyInstanceId(rideInstanceId), [rideInstanceId])
  const legacyRedirect = useLegacyDepartureRedirect(
    legacyLink,
    (departureId) =>
      `/reservations/${encodeURIComponent(departureId)}?date=${encodeURIComponent(legacyLink?.date ?? "")}`
  )
  const departureQuery = useDepartureQuery(legacyLink ? null : rideInstanceId)
  const selectedRideInstance = useMemo(() => {
    if (!departureQuery.data) return null
    return toDepartureInstance(
      departureQuery.data,
      rides.find((ride) => ride.id === departureQuery.data?.rideId)
    )
  }, [departureQuery.data, rides])
  const departureNotFound =
    legacyRedirect.notFound || (!legacyLink && departureQuery.isSuccess && departureQuery.data === null)
  // A failed read is not a missing bus: the page offers a retry instead.
  const departureError = legacyRedirect.isError || departureQuery.isError
  const retryDeparture = legacyLink ? legacyRedirect.retry : departureQuery.refetch
  // A cancelled, dropped or LEGACY departure refuses every booking (#27, PR
  // 4b). Its passengers can still be edited, moved or cancelled.
  const bookingClosed = selectedRideInstance?.status === "cancelled"
  const reservationsQuery = useReservationsByRideInstanceQuery(selectedRideInstance)
  const moveSeatMutation = useMoveReservationSeatMutation()
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
    const date = selectedRideInstance?.date ?? searchParams?.get("date")
    if (date) {
      const parsed = new Date(`${date}T00:00:00`)
      if (!Number.isNaN(parsed.getTime())) {
        setSelectedDate(parsed)
      }
    }
  }, [selectedRideInstance?.date, searchParams, setSelectedDate])

  useEffect(() => {
    setSelectedSeat(null)
    setSelectedSeats([])
    setReservationToEdit(null)
  }, [rideInstanceId])

  // A refused booking refetches the departure. When it no longer runs, the
  // booking form closes rather than offer a bus the server will refuse again.
  useEffect(() => {
    if (bookingClosed) {
      setIsMultiReservationModalOpen(false)
    }
  }, [bookingClosed])

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
    const selectingReserved = Boolean(reservation)
    const selectedReservationExists = selectedSeats.some((selected) =>
      reservations.some((candidate) => candidate.status === "active" && candidate.seatNumber === selected)
    )
    if (selectedSeats.length > 0 && selectedReservationExists !== selectingReserved) {
      // A different seat type begins a new command. This keeps the bottom bar
      // unambiguous without asking the operator to clear the old selection.
      setSelectedSeats([seatNumber])
      setSelectedSeat(null)
      return
    }
    toggleSelectedSeat(seatNumber)
  }

  const handleSeatMove = (reservationId: string, targetSeatNumber: number) => {
    if (!selectedRideInstance) return
    moveSeatMutation.mutate({
      reservationId,
      targetSeatNumber,
      rideInstanceId: selectedRideInstance.id,
    })
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
    options: { fileName: string; format: "xlsx" | "pdf"; numbering: "sequential" | "seat" } = {
      fileName: buildDefaultExportFileName(),
      format: "xlsx",
      numbering: "sequential",
    }
  ) => {
    if (!selectedRideInstance) return

    const rideReservations = selectRideInstancePassengers(reservations, selectedRideInstance)
    const headers = [...PASSENGER_LIST_HEADERS]
    const listRows = await buildPassengerListRows(selectedRideInstance, rideReservations)
    const rows = listRows.map((row) => toPassengerListCells(row, options.numbering))

    const safeBaseName = sanitizeFileNamePart(options.fileName) || buildDefaultExportFileName()
    const headingText = buildPassengerListHeading(selectedRideInstance, rideReservations.length)

    if (options.format === "pdf") {
      const doc = await createPassengerListPdf({
        heading: headingText,
        headers,
        rows,
        groupedRowIndexes: new Set(
          listRows.flatMap((row, index) => (row.hasGroupOverlay ? [index] : []))
        ),
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

    const groupRowFillArgb = "FFE5E7EB"
    rows.forEach((row, index) => {
      const addedRow = worksheet.addRow(row)
      const hasGroupOverlay = listRows[index].hasGroupOverlay
      addedRow.eachCell((cell) => {
        cell.border = {
          top: { style: "thin" },
          left: { style: "thin" },
          bottom: { style: "thin" },
          right: { style: "thin" },
        }
        if (hasGroupOverlay) {
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

  const selectedReservations = useMemo(() => reservations.filter((reservation) =>
    reservation.status === "active" && selectedSeats.includes(reservation.seatNumber)
  ), [reservations, selectedSeats])

  const openSelectedReservationForEdit = () => {
    const reservation = selectedReservations[0]
    if (!reservation) return
    setReservationToEdit(reservation)
    setSelectedSeat(reservation.seatNumber)
    setIsReservationModalOpen(true)
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
      departureQuery.isLoading ||
      legacyRedirect.resolving,
    departureNotFound,
    departureError,
    retryDeparture,
    bookingClosed,
    selectedSeat,
    selectedSeats,
    selectedReservations,
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
    handleSeatMove,
    isSeatMovePending: moveSeatMutation.isPending,
    handleExport,
    buildDefaultExportFileName,
    handleSingleReservationOpenChange,
    refetchReservations: reservationsQuery.refetch,
    setIsMultiReservationModalOpen,
    isBulkCancelOpen,
    setIsBulkCancelOpen,
    openSelectedReservationForEdit,
  }
}
