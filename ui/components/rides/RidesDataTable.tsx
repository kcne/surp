"use client"

import { useMemo } from "react"
import { DataTable } from "@/components/ui/data-table"
import { getRidesTableColumns } from "@/components/rides/RidesTableColumns"
import type { Ride } from "@/types"

interface RidesDataTableProps {
  rides: Ride[]
  onViewInstances: (ride: Ride) => void
  onEdit: (ride: Ride) => void
  onDelete: (ride: Ride) => void
}

export function RidesDataTable({
  rides,
  onViewInstances,
  onEdit,
  onDelete,
}: RidesDataTableProps) {
  const columns = useMemo(
    () => getRidesTableColumns({ onViewInstances, onEdit, onDelete }),
    [onViewInstances, onEdit, onDelete]
  )

  return (
    <DataTable
      columns={columns}
      data={rides}
      noResultsText="Nema rezultata za uneti pojam"
      searchColumn="lineSearch"
      searchPlaceholder="Pretraži raspored"
      initialPageSize={10}
      pageSizeOptions={[10, 20, 30]}
    />
  )
}
