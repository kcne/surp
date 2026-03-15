"use client"

import type { ColumnDef } from "@tanstack/react-table"
import { createActionsColumn, type RowActionHandlers } from "@/components/ui/table-column-helpers"
import { Flag, MapPin, Route } from "lucide-react"
import type { Line } from "@/types"

export function getLinesTableColumns({
  onEdit,
  onDelete,
}: RowActionHandlers<Line>): ColumnDef<Line>[] {
  return [
    {
      accessorKey: "name",
      header: () => (
        <div className="inline-flex items-center gap-1">
          <Route className="h-4 w-4 text-muted-foreground" />
          Ime linije
        </div>
      ),
      cell: ({ row }) => {
        const line = row.original

        return (
          <div>
            <div className="font-semibold text-primary">{line.name}</div>
            {line.directionMode === "both" && (
              <div className="text-xs text-muted-foreground">Dvosmerna linija</div>
            )}
          </div>
        )
      },
    },
    {
      id: "departureStation",
      header: () => (
        <div className="inline-flex items-center gap-1">
          <MapPin className="h-4 w-4 text-muted-foreground" />
          Polazna stanica
        </div>
      ),
      cell: ({ row }) => row.original.departureStation.name,
    },
    {
      id: "arrivalStation",
      header: () => (
        <div className="inline-flex items-center gap-1">
          <Flag className="h-4 w-4 text-muted-foreground" />
          Dolazna stanica
        </div>
      ),
      cell: ({ row }) => row.original.arrivalStation.name,
    },
    createActionsColumn({ onEdit, onDelete }),
  ]
}
