"use client"

import { useEffect, useState } from "react"
import { Layout } from "@/components/layout/Layout"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Plus, CalendarClock } from "lucide-react"
import { useRidesStore } from "@/stores/ridesStore"
import { RideModal } from "@/components/rides/RideModal"
import { DeleteRideDialog } from "@/components/rides/DeleteRideDialog"
import { RideInstancesView } from "@/components/rides/RideInstancesView"
import { RidesDataTable } from "@/components/rides/RidesDataTable"
import { useCrudDialogState } from "@/hooks/useCrudDialogState"
import type { Ride } from "@/types"

export default function SchedulePage() {
  const { rides, loading, fetchRides } = useRidesStore()
  const [isInstancesViewOpen, setIsInstancesViewOpen] = useState(false)
  const [instancesRide, setInstancesRide] = useState<Ride | null>(null)
  const {
    isModalOpen,
    isDeleteDialogOpen,
    selectedItem: selectedRide,
    itemToDelete: rideToDelete,
    openCreate,
    openEdit,
    closeModal,
    openDelete,
    setIsDeleteDialogOpen,
  } = useCrudDialogState<Ride>()

  useEffect(() => {
    fetchRides()
  }, [fetchRides])

  const handleEdit = (ride: Ride) => {
    openEdit(ride)
  }

  const handleDelete = (ride: Ride) => {
    openDelete(ride)
  }

  const handleViewInstances = (ride: Ride) => {
    setInstancesRide(ride)
    setIsInstancesViewOpen(true)
  }

  const handleAddNew = () => {
    openCreate()
  }

  const scheduledRides = rides.filter((ride) => ride.status === "scheduled")

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="flex items-center gap-2 text-2xl font-bold">
              <CalendarClock className="h-6 w-6 text-primary" />
              Raspored Vožnji
            </h1>
            <p className="text-muted-foreground">
              Upravljajte rasporedom autobuskih vožnji
            </p>
          </div>
          <Button onClick={handleAddNew}>
            <Plus className="mr-2 h-4 w-4" />
            Dodaj Vožnju
          </Button>
        </div>

        {loading && rides.length === 0 ? (
          <div className="space-y-4">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
          </div>
        ) : scheduledRides.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-lg border border-dashed p-12">
            <CalendarClock className="mb-3 h-10 w-10 text-muted-foreground" />
            <p className="text-lg font-medium text-muted-foreground">
              Nema zakazanih vožnji
            </p>
            <p className="mb-4 text-sm text-muted-foreground">
              Dodajte raspored da biste počeli
            </p>
            <Button onClick={handleAddNew}>
              <Plus className="mr-2 h-4 w-4" />
              Dodaj Vožnju
            </Button>
          </div>
        ) : (
          <RidesDataTable
            rides={scheduledRides}
            onViewInstances={handleViewInstances}
            onEdit={handleEdit}
            onDelete={handleDelete}
          />
        )}

        <RideModal
          open={isModalOpen}
          onOpenChange={closeModal}
          ride={selectedRide}
        />

        <DeleteRideDialog
          open={isDeleteDialogOpen}
          onOpenChange={setIsDeleteDialogOpen}
          ride={rideToDelete}
        />

        {instancesRide && (
          <RideInstancesView
            open={isInstancesViewOpen}
            onOpenChange={(open) => {
              setIsInstancesViewOpen(open)
              if (!open) {
                setInstancesRide(null)
              }
            }}
            ride={instancesRide}
          />
        )}
      </div>
    </Layout>
  )
}

