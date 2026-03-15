"use client"

import { useMemo } from "react"
import { DataTable } from "@/components/ui/data-table"
import { getPassengersTableColumns } from "@/components/passengers/PassengersTableColumns"
import type { Passenger } from "@/types"

interface PassengersDataTableProps {
  passengers: Passenger[]
  onEdit: (passenger: Passenger) => void
  onDelete: (passenger: Passenger) => void
}

export function PassengersDataTable({
  passengers,
  onEdit,
  onDelete,
}: PassengersDataTableProps) {
  const columns = useMemo(
    () => getPassengersTableColumns({ onEdit, onDelete }),
    [onEdit, onDelete]
  )

  return (
    <DataTable
      columns={columns}
      data={passengers}
      noResultsText="Nema putnika"
      searchColumn="fullName"
      searchPlaceholder="Pretraži putnike..."
    />
  )
}
