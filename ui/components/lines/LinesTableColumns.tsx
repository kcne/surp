"use client"

import type { ColumnDef } from "@tanstack/react-table"
import { Button } from "@/components/ui/button"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import type { RowActionHandlers } from "@/components/ui/table-column-helpers"
import { AlertTriangle, ArrowLeftRight, Flag, MapPin, Pencil, Route, Settings2, Trash2 } from "lucide-react"
import type { Line } from "@/types"

interface LinesTableColumnOptions extends RowActionHandlers<Line> {
  /** The opposite direction of a BOTH pair, which has no row of its own. */
  getReturnLine: (line: Line) => Line | undefined
}

/**
 * The return direction should depart from where the outbound arrives and arrive
 * where it departs. When it does not, return tickets through the odd terminus
 * cannot be booked, so the row says so instead of leaving it invisible.
 */
function isMirroredPair(line: Line, returnLine: Line): boolean {
  return (
    returnLine.departureStation.id === line.arrivalStation.id &&
    returnLine.arrivalStation.id === line.departureStation.id
  )
}

export function getLinesTableColumns({
  onEdit,
  onDelete,
  getReturnLine,
}: LinesTableColumnOptions): ColumnDef<Line>[] {
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
        const returnLine = getReturnLine(line)
        const mismatched = returnLine && !isMirroredPair(line, returnLine)

        return (
          <div>
            <div className="font-semibold text-primary">{line.name}</div>
            {line.directionMode === "both" && (
              <div className="text-xs text-muted-foreground">Dvosmerna linija</div>
            )}

            {mismatched && returnLine ? (
              <div className="mt-1 flex items-start gap-1 text-xs text-amber-600">
                <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />
                <span>
                  Povratak: {returnLine.departureStation.name} →{" "}
                  {returnLine.arrivalStation.name}
                </span>
              </div>
            ) : null}
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
        const returnLine = getReturnLine(line)

        return (
          <div className="flex items-center justify-end gap-2">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" onClick={() => onEdit(line)}>
                  <Pencil className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Izmeni polazni smer</TooltipContent>
            </Tooltip>

            {returnLine ? (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => onEdit(returnLine)}
                  >
                    <ArrowLeftRight className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  Izmeni povratni smer ({returnLine.departureStation.name} →{" "}
                  {returnLine.arrivalStation.name})
                </TooltipContent>
              </Tooltip>
            ) : null}

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => onDelete(line)}
                  className="text-danger hover:text-danger hover:bg-danger/10"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Obriši liniju</TooltipContent>
            </Tooltip>
          </div>
        )
      },
    },
  ]
}
