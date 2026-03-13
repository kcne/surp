"use client"

import type { ColumnDef } from "@tanstack/react-table"
import { Button } from "@/components/ui/button"
import { Flag, MapPin, Pencil, Route, Settings2, Trash2 } from "lucide-react"
import type { Line } from "@/types"

interface LineColumnActions {
  onEdit: (line: Line) => void
  onDelete: (line: Line) => void
}

export function getLinesTableColumns({
  onEdit,
  onDelete,
}: LineColumnActions): ColumnDef<Line>[] {
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
    {
      id: "actions",
      header: () => (
        <div className="inline-flex items-center justify-end gap-1 text-right">
          <Settings2 className="h-4 w-4 text-muted-foreground" />
          Akcije
        </div>
      ),
      cell: ({ row }) => {
        const line = row.original

        return (
          <div className="flex items-center justify-end gap-2">
            <Button variant="ghost" size="icon" onClick={() => onEdit(line)}>
              <Pencil className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onDelete(line)}
              className="text-danger hover:text-danger hover:bg-danger/10"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        )
      },
    },
  ]
}
