"use client"

import { useMemo } from "react"
import { DataTable } from "@/components/ui/data-table"
import { getStationsTableColumns } from "@/components/stations/StationsTableColumns"
import type { StationListItem } from "@/infrastructure/hooks/queries/useStationsListQuery"

interface StationsDataTableProps {
  stations: StationListItem[]
  onView: (station: StationListItem) => void
  onEdit: (station: StationListItem) => void
  onDelete: (station: StationListItem) => void
}

export function StationsDataTable({
  stations,
  onView,
  onEdit,
  onDelete,
}: StationsDataTableProps) {
  const columns = useMemo(
    () => getStationsTableColumns({ onView, onEdit, onDelete }),
    [onView, onEdit, onDelete]
  )

  return (
    <DataTable
      columns={columns}
      data={stations}
      noResultsText="Nema rezultata za uneti pojam"
      searchColumn="name"
      searchPlaceholder="Pretraži stanice"
      initialPageSize={10}
      pageSizeOptions={[10, 20, 30]}
    />
  )
}
