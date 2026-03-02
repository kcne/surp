"use client"

import { useEffect, useState } from "react"
import { useParams } from "next/navigation"
import { Layout } from "@/components/layout/Layout"
import { SeatMap } from "@/components/reservations/SeatMap"
import { ReservationModal } from "@/components/reservations/ReservationModal"
import { DeleteReservationDialog } from "@/components/reservations/DeleteReservationDialog"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Armchair, CalendarClock, Download, Eraser, Info, Route, Ticket } from "lucide-react"
import { useRidesStore } from "@/stores/ridesStore"
import { useReservationsStore } from "@/stores/reservationsStore"
import { formatDateDisplay, formatTimeDisplay } from "@/utils/dateHelpers"
import type { Reservation } from "@/types"

export default function SeatMapPage() {
  const params = useParams()
  const rideInstanceId = params.rideInstanceId as string

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
  } = useReservationsStore()

  const [isReservationModalOpen, setIsReservationModalOpen] = useState(false)
  const [isMultiReservationModalOpen, setIsMultiReservationModalOpen] = useState(false)
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [reservationToDelete, setReservationToDelete] = useState<Reservation | null>(null)
  const [reservationToEdit, setReservationToEdit] = useState<Reservation | null>(null)

  // Fetch trip instances for the selected date
  useEffect(() => {
    if (selectedDate) {
      fetchRideInstances(selectedDate)
    }
  }, [selectedDate, fetchRideInstances])

  // Set selected ride instance when trip instances are loaded
  useEffect(() => {
    const instance = rideInstances.find((ri) => ri.id === rideInstanceId)
    if (instance) {
      setSelectedRideInstance(instance)
      // fetchReservations will be called automatically by setSelectedRideInstance
    }
  }, [rideInstanceId, rideInstances, setSelectedRideInstance])

  // Ensure reservations are loaded when selectedRideInstance changes
  // (This is a backup in case setSelectedRideInstance doesn't trigger fetchReservations)
  useEffect(() => {
    if (selectedRideInstance && selectedRideInstance.id === rideInstanceId) {
      fetchReservations(selectedRideInstance.id)
    }
  }, [selectedRideInstance, rideInstanceId, fetchReservations])

  const handleSeatClick = (seatNumber: number, reservation?: Reservation) => {
    if (reservation) {
      setReservationToEdit(reservation)
      useReservationsStore.getState().setSelectedSeat(seatNumber)
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
      .sort((a, b) => a.seatNumber - b.seatNumber)

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

    const csvContent =
      "\uFEFF" +
      [headers, ...rows]
        .map((row) => row.map((cell) => escapeCsv(cell)).join(","))
        .join("\n")

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

  if (!selectedRideInstance) {
    return (
      <Layout>
        <div className="space-y-4">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-48 w-full" />
        </div>
      </Layout>
    )
  }

  const routeName = selectedRideInstance.ride.line.name
  const reservedCount = seatMap?.reservedCount || 0
  const totalSeats = seatMap?.capacity || selectedRideInstance.ride.busCapacity
  const localizedRideDate = new Date(selectedRideInstance.date).toLocaleDateString("sr-Latn-RS", {
    day: "numeric",
    month: "long",
    year: "numeric",
  })

  return (
    <Layout>
      <div className="space-y-6">
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink href="/reservations">Rezervacije</BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbLink href="/reservations">
                {selectedDate ? formatDateDisplay(selectedDate) : "Datum"}
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>{routeName}</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>

        <Card>
          <CardHeader>
            <div className="flex items-start justify-between gap-4">
              <div>
                <CardTitle className="flex items-center gap-2 text-xl font-bold">
                  <Route className="h-5 w-5 text-primary" />
                  {routeName}
                </CardTitle>
                <CardDescription className="mt-2 space-y-1">
                  <p className="flex items-center gap-2">
                    <Route className="h-4 w-4 text-muted-foreground" />
                    <span className="font-semibold">Ime linije:</span>{" "}
                    {selectedRideInstance.ride.line.name}
                  </p>
                  <p className="flex items-center gap-2">
                    <CalendarClock className="h-4 w-4 text-muted-foreground" />
                    <span className="font-semibold">Datum i vreme polaska:</span>{" "}
                    <span className="font-semibold">
                      {localizedRideDate} {formatTimeDisplay(selectedRideInstance.departureTime)}
                    </span>
                  </p>
                  <p className="flex items-center gap-2">
                    <Armchair className="h-4 w-4 text-muted-foreground" />
                    <span className="font-semibold">Sedišta (total/reserved):</span>{" "}
                    {totalSeats}/{reservedCount}
                  </p>
                </CardDescription>
              </div>
              <Button onClick={handleExport} variant="outline">
                <Download className="mr-2 h-4 w-4" />
                Izvezi listu putnika
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-1">
            <CardTitle className="flex items-center gap-2 text-base">
              <Armchair className="h-4 w-4 text-primary" />
              Izabrana sedišta
            </CardTitle>
            <CardDescription className="leading-tight text-xs">
              {selectedSeats.length === 0
                ? "Izaberite sedišta iz mape ispod."
                : selectedSeats.length === 1
                ? "Jedno sedište je izabrano."
                : `${selectedSeats.length} sedišta su izabrana.`}
            </CardDescription>
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex flex-wrap gap-2">
              {selectedSeats.length === 0 ? (
                <Badge variant="outline" className="inline-flex items-center gap-1">
                  <Info className="h-3 w-3" />
                  Nema izabranih sedišta
                </Badge>
              ) : (
                selectedSeats
                  .slice()
                  .sort((a, b) => a - b)
                  .map((seatNumber) => (
                    <Badge key={seatNumber} variant="secondary" className="inline-flex items-center gap-1">
                      <Armchair className="h-3 w-3" />
                      Sedište {seatNumber}
                    </Badge>
                  ))
              )}
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={clearSelectedSeats}
                  disabled={selectedSeats.length === 0}
                >
                  <Eraser className="mr-2 h-4 w-4" />
                  Očisti
                </Button>
                <Button
                  onClick={() => setIsMultiReservationModalOpen(true)}
                  disabled={selectedSeats.length === 0}
                >
                  <Ticket className="mr-2 h-4 w-4" />
                  Rezerviši
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Seat Map */}
        {loading && !seatMap ? (
          <Skeleton className="h-96 w-full" />
        ) : seatMap ? (
          <SeatMap
            seats={seatMap.seats}
            capacity={seatMap.capacity}
            onSeatClick={handleSeatClick}
            allowMultiSelect
            selectedSeats={selectedSeats}
          />
        ) : null}

        <ReservationModal
          open={isReservationModalOpen}
          onOpenChange={(open) => {
            setIsReservationModalOpen(open)
            if (!open) {
              // Clear reservation to edit when modal closes
              setReservationToEdit(null)
            }
          }}
          seatNumber={selectedSeat}
          reservation={reservationToEdit}
        />

        <ReservationModal
          open={isMultiReservationModalOpen}
          onOpenChange={(open) => {
            setIsMultiReservationModalOpen(open)
          }}
          seatNumber={selectedSeat}
          reservation={null}
          selectedSeats={selectedSeats}
          multipleSelectionMode
          onComplete={() => {
            setIsMultiReservationModalOpen(false)
          }}
        />

        <DeleteReservationDialog
          open={isDeleteDialogOpen}
          onOpenChange={setIsDeleteDialogOpen}
          reservation={reservationToDelete}
        />
      </div>
    </Layout>
  )
}
