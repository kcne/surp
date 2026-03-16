"use client"

import type { ColumnDef } from "@tanstack/react-table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Eye, FileText, Map, MapPin, Pencil, Phone, Settings2, Tags, Trash2 } from "lucide-react"
import type { StationListItem } from "@/infrastructure/hooks/queries/useStationsListQuery"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"

interface StationColumnActions {
  onView: (station: StationListItem) => void
  onEdit: (station: StationListItem) => void
  onDelete: (station: StationListItem) => void
}

export function getStationsTableColumns({
  onView,
  onEdit,
  onDelete,
}: StationColumnActions): ColumnDef<StationListItem>[] {
  return [
    {
      accessorKey: "name",
      header: () => (
        <span className="inline-flex items-center gap-1">
          <MapPin className="h-4 w-4 text-muted-foreground" />
          Naziv Stanice
        </span>
      ),
      cell: ({ row }) => <div className="font-semibold text-primary">{row.original.name}</div>,
    },
    {
      accessorKey: "address",
      header: () => (
        <span className="inline-flex items-center gap-1">
          <Map className="h-4 w-4 text-muted-foreground" />
          Adresa
        </span>
      ),
    },
    {
      accessorKey: "category",
      header: () => (
        <span className="inline-flex items-center gap-1">
          <Tags className="h-4 w-4 text-muted-foreground" />
          Kategorija
        </span>
      ),
      cell: ({ row }) =>
        row.original.categoryLabel !== "-" ? (
          <Badge variant="secondary">{row.original.categoryLabel}</Badge>
        ) : (
          <span className="text-muted-foreground">-</span>
        ),
    },
    {
      accessorKey: "contactPhone",
      header: () => (
        <span className="inline-flex items-center gap-1">
          <Phone className="h-4 w-4 text-muted-foreground" />
          Kontakt telefon
        </span>
      ),
      cell: ({ row }) => row.original.contactPhone || <span className="text-muted-foreground">-</span>,
    },
    {
      accessorKey: "notes",
      header: () => (
        <span className="inline-flex items-center gap-1">
          <FileText className="h-4 w-4 text-muted-foreground" />
          Napomene
        </span>
      ),
      cell: ({ row }) => {
        const notes = row.original.notes || ""

        if (!notes) {
          return <span className="text-muted-foreground">-</span>
        }

        const preview = notes.length > 50 ? `${notes.substring(0, 50)}...` : notes

        return (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="inline-block max-w-[200px] cursor-help truncate">{preview}</span>
              </TooltipTrigger>
              <TooltipContent>
                <p className="max-w-xs">{notes}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )
      },
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
        const station = row.original

        return (
          <div className="flex items-center justify-end gap-2">
            <Button variant="ghost" size="icon" onClick={() => onView(station)}>
              <Eye className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" onClick={() => onEdit(station)}>
              <Pencil className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onDelete(station)}
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
