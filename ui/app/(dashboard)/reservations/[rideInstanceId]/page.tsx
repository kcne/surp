"use client"

import { useState } from "react"
import { useParams } from "next/navigation"
import { Layout } from "@/components/layout/Layout"
import { SeatMap } from "@/components/reservations/SeatMap"
import { ReservationModal } from "@/components/reservations/ReservationModal"
import { RideInstanceSummaryCard } from "@/components/reservations/RideInstanceSummaryCard"
import { ExportPassengersDialog } from "@/components/reservations/ExportPassengersDialog"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"
import { Skeleton } from "@/components/ui/skeleton"
import { Route, Ticket } from "lucide-react"
import { useRideInstanceSeatMapPage } from "@/hooks/useRideInstanceSeatMapPage"
import { formatDateDisplay, formatTimeDisplay } from "@/utils/dateHelpers"

export default function SeatMapPage() {
  const params = useParams<{ rideInstanceId: string }>()
  const rideInstanceId = decodeURIComponent(params?.rideInstanceId ?? "")
  const {
    selectedDate,
    seatMap,
    reservations,
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
    buildDefaultExportFileName,
    handleSingleReservationOpenChange,
    refetchReservations,
    setIsMultiReservationModalOpen,
  } = useRideInstanceSeatMapPage({ rideInstanceId })

  const [isExportDialogOpen, setIsExportDialogOpen] = useState(false)

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

        <RideInstanceSummaryCard
          selectedRideInstance={selectedRideInstance}
          routeName={routeName}
          localizedRideDate={localizedRideDate}
          reservedCount={reservedCount}
          totalSeats={totalSeats}
          selectedSeats={selectedSeats}
          onClearSelectedSeats={clearSelectedSeats}
          onReserveSelectedSeats={() => setIsMultiReservationModalOpen(true)}
          onExport={() => setIsExportDialogOpen(true)}
        />

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
          onOpenChange={handleSingleReservationOpenChange}
          selectedRideInstance={selectedRideInstance}
          reservations={reservations}
          seatNumber={selectedSeat}
          reservation={reservationToEdit}
          onComplete={() => {
            void refetchReservations()
          }}
        />

        <ReservationModal
          open={isMultiReservationModalOpen}
          onOpenChange={setIsMultiReservationModalOpen}
          selectedRideInstance={selectedRideInstance}
          reservations={reservations}
          seatNumber={selectedSeat}
          reservation={null}
          selectedSeats={selectedSeats}
          multipleSelectionMode
          onComplete={() => {
            setIsMultiReservationModalOpen(false)
            clearSelectedSeats()
            void refetchReservations()
          }}
        />

        <ExportPassengersDialog
          open={isExportDialogOpen}
          onOpenChange={setIsExportDialogOpen}
          defaultFileName={buildDefaultExportFileName()}
          onExport={handleExport}
        />
      </div>
    </Layout>
  )
}
