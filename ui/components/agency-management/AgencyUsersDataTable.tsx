"use client"

import { useMemo } from "react"
import { DataTable } from "@/components/ui/data-table"
import { getAgencyUsersTableColumns } from "@/components/agency-management/AgencyUsersTableColumns"
import type { AgencyUser } from "@/components/agency-management/types"

interface AgencyUsersDataTableProps {
  users: AgencyUser[]
  onEdit: (user: AgencyUser) => void
  onDelete: (user: AgencyUser) => void
  onResetPassword: (user: AgencyUser) => void
}

export function AgencyUsersDataTable({
  users,
  onEdit,
  onDelete,
  onResetPassword,
}: AgencyUsersDataTableProps) {
  const columns = useMemo(
    () => getAgencyUsersTableColumns({ onEdit, onDelete, onResetPassword }),
    [onEdit, onDelete, onResetPassword]
  )

  return (
    <DataTable
      columns={columns}
      data={users}
      noResultsText="Nema korisnika"
      searchColumn="username"
      searchPlaceholder="Pretraži korisnike..."
    />
  )
}
