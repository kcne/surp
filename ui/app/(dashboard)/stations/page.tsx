"use client"

import { useState } from "react"
import { Layout } from "@/components/layout/Layout"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Plus, MapPin } from "lucide-react"
import { StationModal } from "@/components/stations/StationModal"
import { DeleteStationDialog } from "@/components/stations/DeleteStationDialog"
import { StationsDataTable } from "@/components/stations/StationsDataTable"
import { useCrudDialogState } from "@/hooks/useCrudDialogState"
import {
  useCreateStationMutation,
  useDeleteStationMutation,
  useUpdateStationMutation,
} from "@/infrastructure/hooks/mutations/useStationMutations"
import { useStationsListQuery } from "@/infrastructure/hooks/queries/useStationsListQuery"
import type { CreateStationDto, UpdateStationDto } from "@/infrastructure/generated/model"
import type { StationListItem } from "@/infrastructure/hooks/queries/useStationsListQuery"

export default function StationsPage() {
  const stationsQuery = useStationsListQuery()
  const createStationMutation = useCreateStationMutation()
  const updateStationMutation = useUpdateStationMutation()
  const deleteStationMutation = useDeleteStationMutation()
  const stations = stationsQuery.data || []
  const loading = stationsQuery.isLoading
  const error = stationsQuery.error
  const mutationLoading =
    createStationMutation.isPending ||
    updateStationMutation.isPending ||
    deleteStationMutation.isPending
  const [isViewMode, setIsViewMode] = useState(false)
  const {
    isModalOpen,
    isDeleteDialogOpen,
    selectedItem: selectedStation,
    itemToDelete: stationToDelete,
    openCreate,
    openEdit,
    closeModal,
    openDelete,
    setIsDeleteDialogOpen,
  } = useCrudDialogState<StationListItem>()

  const handleCreate = async (payload: CreateStationDto) => {
    await createStationMutation.mutateAsync(payload)
  }

  const handleUpdate = async (id: string, payload: UpdateStationDto) => {
    await updateStationMutation.mutateAsync({ id, payload })
  }

  const handleDelete = async (id: string) => {
    await deleteStationMutation.mutateAsync(id)
  }

  const handleEdit = (station: StationListItem) => {
    setIsViewMode(false)
    openEdit(station)
  }

  const handleView = (station: StationListItem) => {
    setIsViewMode(true)
    openEdit(station)
  }

  const handleOpenDelete = (station: StationListItem) => {
    openDelete(station)
  }

  const handleAddNew = () => {
    setIsViewMode(false)
    openCreate()
  }

  const handleModalClose = () => {
    closeModal()
    setIsViewMode(false)
  }

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="flex items-center gap-2 text-2xl font-bold">
              <MapPin className="h-6 w-6 text-primary" />
              Stanice
            </h1>
            <p className="text-muted-foreground">
              Upravljajte autobuskim stanicama u sistemu
            </p>
          </div>
          <Button onClick={handleAddNew}>
            <Plus className="mr-2 h-4 w-4" />
            Dodaj Stanicu
          </Button>
        </div>

        {loading && stations.length === 0 ? (
          <div className="space-y-4">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
          </div>
        ) : stationsQuery.isError ? (
          <div className="flex flex-col items-center justify-center rounded-lg border border-dashed p-12">
            <MapPin className="mb-3 h-10 w-10 text-muted-foreground" />
            <p className="text-lg font-medium text-muted-foreground">
              Greska pri ucitavanju stanica
            </p>
            <p className="mb-4 text-sm text-muted-foreground">
              {error instanceof Error
                ? error.message
                : "Pokrenite ponovno ucitavanje podataka."}
            </p>
            <Button onClick={() => stationsQuery.refetch()}>
              Pokusaj ponovo
            </Button>
          </div>
        ) : stations.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-lg border border-dashed p-12">
            <MapPin className="mb-3 h-10 w-10 text-muted-foreground" />
            <p className="text-lg font-medium text-muted-foreground">
              Nema stanica
            </p>
            <p className="mb-4 text-sm text-muted-foreground">
              Dodajte prvu stanicu da biste počeli
            </p>
            <Button onClick={handleAddNew}>
              <Plus className="mr-2 h-4 w-4" />
              Dodaj Stanicu
            </Button>
          </div>
        ) : (
          <StationsDataTable
            stations={stations}
            onView={handleView}
            onEdit={handleEdit}
            onDelete={handleOpenDelete}
          />
        )}

        <StationModal
          open={isModalOpen}
          onOpenChange={handleModalClose}
          station={selectedStation}
          readOnly={isViewMode}
          loading={mutationLoading}
          onCreate={handleCreate}
          onUpdate={handleUpdate}
        />

        <DeleteStationDialog
          open={isDeleteDialogOpen}
          onOpenChange={setIsDeleteDialogOpen}
          station={stationToDelete}
          loading={mutationLoading}
          onDelete={handleDelete}
        />
      </div>
    </Layout>
  )
}










