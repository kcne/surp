"use client"

import { useEffect, useState } from "react"
import { Layout } from "@/components/layout/Layout"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Plus, MapPin } from "lucide-react"
import { useStationsStore } from "@/stores/stationsStore"
import { StationModal } from "@/components/stations/StationModal"
import { DeleteStationDialog } from "@/components/stations/DeleteStationDialog"
import { StationsDataTable } from "@/components/stations/StationsDataTable"
import { useCrudDialogState } from "@/hooks/useCrudDialogState"
import type { Station } from "@/types"

export default function StationsPage() {
  const { stations, loading, fetchStations } = useStationsStore()
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
  } = useCrudDialogState<Station>()

  useEffect(() => {
    fetchStations()
  }, [fetchStations])

  const handleEdit = (station: Station) => {
    setIsViewMode(false)
    openEdit(station)
  }

  const handleView = (station: Station) => {
    setIsViewMode(true)
    openEdit(station)
  }

  const handleDelete = (station: Station) => {
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
            onDelete={handleDelete}
          />
        )}

        <StationModal
          open={isModalOpen}
          onOpenChange={handleModalClose}
          station={selectedStation}
          readOnly={isViewMode}
        />

        <DeleteStationDialog
          open={isDeleteDialogOpen}
          onOpenChange={setIsDeleteDialogOpen}
          station={stationToDelete}
        />
      </div>
    </Layout>
  )
}










