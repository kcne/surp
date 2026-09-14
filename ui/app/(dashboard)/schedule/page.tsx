"use client"

import { useEffect, useState } from "react"
import { Layout } from "@/components/layout/Layout"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Plus, CalendarClock } from "lucide-react"
import { RideModal } from "@/components/rides/RideModal"
import { ConfirmBreakingRideChangeDialog } from "@/components/rides/ConfirmBreakingRideChangeDialog"
import { DeleteRideDialog } from "@/components/rides/DeleteRideDialog"
import { RideInstancesView } from "@/components/rides/RideInstancesView"
import { RidesDataTable } from "@/components/rides/RidesDataTable"
import { useCrudDialogState } from "@/hooks/useCrudDialogState"
import {
  RideChangeNeedsConfirmationError,
  useCreateRideMutation,
  useDeleteRideMutation,
  useUpdateRideMutation,
} from "@/infrastructure/hooks/mutations/useRideMutations"
import type { WouldBreakReservationsDto } from "@/infrastructure/generated/model"
import { useRidesListQuery } from "@/infrastructure/hooks/queries/useRidesListQuery"
import type { Ride, RideFormData } from "@/types"

const EMPTY_RIDES: Ride[] = []

export default function SchedulePage() {
  const ridesQuery = useRidesListQuery()
  const createRideMutation = useCreateRideMutation()
  const updateRideMutation = useUpdateRideMutation()
  const deleteRideMutation = useDeleteRideMutation()
  const rides = ridesQuery.data ?? EMPTY_RIDES
  const loading = ridesQuery.isLoading
  const error = ridesQuery.error
  const mutationLoading =
    createRideMutation.isPending ||
    updateRideMutation.isPending ||
    deleteRideMutation.isPending
  const [isInstancesViewOpen, setIsInstancesViewOpen] = useState(false)
  const [instancesRide, setInstancesRide] = useState<Ride | null>(null)
  // An update the server held back until somebody confirms what it breaks.
  const [pendingChange, setPendingChange] = useState<{
    id: string
    payload: Partial<RideFormData>
    confirmation: WouldBreakReservationsDto
  } | null>(null)
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
    if (!isInstancesViewOpen) {
      return
    }

    if (!instancesRide) {
      return
    }

    const refreshed = rides.find((ride) => ride.id === instancesRide.id)
    if (refreshed) {
      setInstancesRide(refreshed)
    }
  }, [rides, isInstancesViewOpen, instancesRide])

  const handleEdit = (ride: Ride) => {
    openEdit(ride)
  }

  const handleOpenDelete = (ride: Ride) => {
    openDelete(ride)
  }

  const handleViewInstances = (ride: Ride) => {
    setInstancesRide(ride)
    setIsInstancesViewOpen(true)
  }

  const handleAddNew = () => {
    openCreate()
  }

  const handleCreate = async (payload: RideFormData) => {
    await createRideMutation.mutateAsync(payload)
  }

  const handleUpdate = async (id: string, payload: Partial<RideFormData>) => {
    try {
      await updateRideMutation.mutateAsync({ id, payload })
    } catch (error) {
      if (error instanceof RideChangeNeedsConfirmationError) {
        setPendingChange({ id, payload, confirmation: error.confirmation })
      }

      // Rethrown either way, so the form stays open on the values that were
      // typed rather than closing on a change that was never written.
      throw error
    }
  }

  const handleConfirmPendingChange = async () => {
    if (!pendingChange) {
      return
    }

    try {
      await updateRideMutation.mutateAsync({
        id: pendingChange.id,
        payload: pendingChange.payload,
        confirmBreakingChange: true,
      })
      setPendingChange(null)
      closeModal()
    } catch {
      // The mutation already reported it; the dialog stays up to be retried.
    }
  }

  const handleDeleteRide = async (id: string) => {
    await deleteRideMutation.mutateAsync(id)
  }

  const handleCancelInstance = async (ride: Ride, instanceDate: string): Promise<Ride | void> => {
    if (ride.type === "one-time") {
      await deleteRideMutation.mutateAsync(ride.id)
      return
    }

    const existingExceptions = ride.exceptions || []
    const alreadyCancelled = existingExceptions.some(
      (exception) => exception.date === instanceDate && exception.type === "skip"
    )

    if (alreadyCancelled) {
      return ride
    }

    const nextRide = {
      ...ride,
      exceptions: [
        ...existingExceptions,
        {
          id: `${Date.now()}-${instanceDate}`,
          date: instanceDate,
          type: "skip" as const,
        },
      ],
    }

    await updateRideMutation.mutateAsync({
      id: ride.id,
      payload: {
        exceptions: nextRide.exceptions,
      },
    })

    return nextRide
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
        ) : ridesQuery.isError ? (
          <div className="flex flex-col items-center justify-center rounded-lg border border-dashed p-12">
            <CalendarClock className="mb-3 h-10 w-10 text-muted-foreground" />
            <p className="text-lg font-medium text-muted-foreground">
              Greska pri ucitavanju rasporeda
            </p>
            <p className="mb-4 text-sm text-muted-foreground">
              {error instanceof Error
                ? error.message
                : "Pokrenite ponovno ucitavanje podataka."}
            </p>
            <Button onClick={() => ridesQuery.refetch()}>
              Pokusaj ponovo
            </Button>
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
            onDelete={handleOpenDelete}
          />
        )}

        <RideModal
          open={isModalOpen}
          onOpenChange={closeModal}
          ride={selectedRide}
          loading={mutationLoading}
          onCreate={handleCreate}
          onUpdate={handleUpdate}
        />

        <ConfirmBreakingRideChangeDialog
          open={pendingChange !== null}
          onOpenChange={(open) => {
            if (!open) {
              setPendingChange(null)
            }
          }}
          confirmation={pendingChange?.confirmation ?? null}
          loading={mutationLoading}
          onConfirm={handleConfirmPendingChange}
        />

        <DeleteRideDialog
          open={isDeleteDialogOpen}
          onOpenChange={setIsDeleteDialogOpen}
          ride={rideToDelete}
          loading={mutationLoading}
          onDelete={handleDeleteRide}
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
            loading={mutationLoading}
            onCancelInstance={handleCancelInstance}
          />
        )}
      </div>
    </Layout>
  )
}

