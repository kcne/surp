"use client"

import { Layout } from "@/components/layout/Layout"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Plus, Users } from "lucide-react"
import { usePassengersListQuery } from "@/infrastructure/hooks/queries/usePassengersListQuery"
import { PassengerModal } from "@/components/passengers/PassengerModal"
import { DeletePassengerDialog } from "@/components/passengers/DeletePassengerDialog"
import { PassengersDataTable } from "@/components/passengers/PassengersDataTable"
import { useCrudDialogState } from "@/hooks/useCrudDialogState"
import type { Passenger } from "@/types"

export default function PassengersPage() {
  const passengersQuery = usePassengersListQuery()
  const passengers = passengersQuery.data ?? []
  const loading = passengersQuery.isLoading
  const {
    isModalOpen,
    isDeleteDialogOpen,
    selectedItem: selectedPassenger,
    itemToDelete: passengerToDelete,
    openCreate,
    openEdit,
    closeModal,
    openDelete,
    setIsDeleteDialogOpen,
  } = useCrudDialogState<Passenger>()

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="flex items-center gap-2 text-2xl font-bold">
              <Users className="h-6 w-6 text-primary" />
              Putnici
            </h1>
            <p className="text-muted-foreground">
              Upravljajte putnicima u sistemu
            </p>
          </div>
          <Button onClick={openCreate}>
            <Plus className="mr-2 h-4 w-4" />
            Dodaj Putnika
          </Button>
        </div>

        {loading && passengers.length === 0 ? (
          <div className="space-y-4">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
          </div>
        ) : passengers.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-lg border border-dashed p-12">
            <Users className="mb-3 h-10 w-10 text-muted-foreground" />
            <p className="text-lg font-medium text-muted-foreground">
              Nema putnika
            </p>
            <p className="mb-4 text-sm text-muted-foreground">
              Dodajte prvog putnika da biste počeli
            </p>
            <Button onClick={openCreate}>
              <Plus className="mr-2 h-4 w-4" />
              Dodaj Putnika
            </Button>
          </div>
        ) : (
          <PassengersDataTable
            passengers={passengers}
            onEdit={openEdit}
            onDelete={openDelete}
          />
        )}

        <PassengerModal
          open={isModalOpen}
          onOpenChange={closeModal}
          passenger={selectedPassenger}
        />

        <DeletePassengerDialog
          open={isDeleteDialogOpen}
          onOpenChange={setIsDeleteDialogOpen}
          passenger={passengerToDelete}
        />
      </div>
    </Layout>
  )
}
