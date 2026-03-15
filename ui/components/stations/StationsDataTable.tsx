"use client"

import { useMemo } from "react"
import { DataTable } from "@/components/ui/data-table"
import { getStationsTableColumns } from "@/components/stations/StationsTableColumns"
import type { Station } from "@/types"

interface StationsDataTableProps {
  stations: Station[]
  onView: (station: Station) => void
  onEdit: (station: Station) => void
  onDelete: (station: Station) => void
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
