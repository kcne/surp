"use client"

import type { ColumnDef } from "@tanstack/react-table"
import { Badge } from "@/components/ui/badge"
import { createActionsColumn, type RowActionHandlers } from "@/components/ui/table-column-helpers"
import { Mail, Phone, UserRound, Users } from "lucide-react"
import type { Passenger } from "@/types"

const passengerTypeLabels: Record<Passenger["passengerType"], string> = {
  dete: "Dete",
  odrasli: "Odrasli",
  student: "Student",
  penzioner: "Penzioner",
}

export function getPassengersTableColumns({
  onEdit,
  onDelete,
}: RowActionHandlers<Passenger>): ColumnDef<Passenger>[] {
  return [
    {
      accessorFn: (row) => `${row.firstName} ${row.lastName}`,
      id: "fullName",
      header: () => (
        <div className="inline-flex items-center gap-1">
          <UserRound className="h-4 w-4 text-muted-foreground" />
          Ime i prezime
        </div>
      ),
      cell: ({ row }) => (
        <div className="font-semibold text-primary">
          {row.original.firstName} {row.original.lastName}
        </div>
      ),
    },
    {
      accessorKey: "phone",
      header: () => (
        <div className="inline-flex items-center gap-1">
          <Phone className="h-4 w-4 text-muted-foreground" />
          Telefon
        </div>
      ),
    },
    {
      accessorKey: "email",
      header: () => (
        <div className="inline-flex items-center gap-1">
          <Mail className="h-4 w-4 text-muted-foreground" />
          Email
        </div>
      ),
      cell: ({ row }) => row.original.email || <span className="text-muted-foreground">-</span>,
    },
    {
      accessorKey: "passengerType",
      header: () => (
        <div className="inline-flex items-center gap-1">
          <Users className="h-4 w-4 text-muted-foreground" />
          Tip putnika
        </div>
      ),
      cell: ({ row }) => (
        <Badge variant="secondary">{passengerTypeLabels[row.original.passengerType]}</Badge>
      ),
    },
    createActionsColumn({ onEdit, onDelete }),
  ]
}
