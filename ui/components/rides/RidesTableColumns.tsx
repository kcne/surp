"use client"

import type { ColumnDef } from "@tanstack/react-table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Clock3, Eye, Pencil, Route, Settings2, Tags, X } from "lucide-react"
import type { Ride } from "@/types"
import { formatTime } from "@/utils/formatters"

const DAYS_OF_WEEK = [
  { value: 1, label: "Pon" },
  { value: 2, label: "Uto" },
  { value: 3, label: "Sre" },
  { value: 4, label: "Čet" },
  { value: 5, label: "Pet" },
  { value: 6, label: "Sub" },
  { value: 0, label: "Ned" },
]

interface RideColumnActions {
  onViewInstances: (ride: Ride) => void
  onEdit: (ride: Ride) => void
  onDelete: (ride: Ride) => void
}

function getTypeBadge(type: Ride["type"]) {
  return (
    <Badge variant={type === "recurring" ? "default" : "secondary"}>
      {type === "recurring" ? "Ponavljajuća" : "Jednokratna"}
    </Badge>
  )
}

function getDepartureForDay(ride: Ride, dayValue: number) {
  if (ride.type === "recurring") {
    if (ride.dayTimes?.[dayValue]?.departureTime) {
      return formatTime(ride.dayTimes[dayValue].departureTime)
    }

    if (ride.daysOfWeek?.includes(dayValue) && ride.departureTime) {
      return formatTime(ride.departureTime)
    }

    return "-"
  }

  if (ride.type === "one-time" && ride.date && ride.oneTimeDepartureTime) {
    const rideDay = new Date(`${ride.date}T00:00:00`).getDay()
    return rideDay === dayValue ? formatTime(ride.oneTimeDepartureTime) : "-"
  }

  return "-"
}

export function getRidesTableColumns({
  onViewInstances,
  onEdit,
  onDelete,
}: RideColumnActions): ColumnDef<Ride>[] {
  const dayColumns: ColumnDef<Ride>[] = DAYS_OF_WEEK.map((day) => ({
    id: `day-${day.value}`,
    header: () => (
      <span className="inline-flex items-center gap-1">
        <Clock3 className="h-3.5 w-3.5 text-muted-foreground" />
        {day.label}
      </span>
    ),
    cell: ({ row }) => getDepartureForDay(row.original, day.value),
  }))

  return [
    {
      accessorFn: (row) => `${row.line.name} ${row.type === "recurring" ? "ponavljajuća" : "jednokratna"}`,
      id: "lineSearch",
      header: () => (
        <span className="inline-flex items-center gap-1">
          <Route className="h-4 w-4 text-muted-foreground" />
          Linija
        </span>
      ),
      cell: ({ row }) => <div className="font-semibold text-primary">{row.original.line.name}</div>,
    },
    {
      accessorKey: "type",
      header: () => (
        <span className="inline-flex items-center gap-1">
          <Tags className="h-4 w-4 text-muted-foreground" />
          Tip
        </span>
      ),
      cell: ({ row }) => getTypeBadge(row.original.type),
    },
    ...dayColumns,
    {
      id: "actions",
      header: () => (
        <div className="inline-flex items-center justify-end gap-1 text-right">
          <Settings2 className="h-4 w-4 text-muted-foreground" />
          Akcije
        </div>
      ),
      cell: ({ row }) => {
        const ride = row.original

        return (
          <div className="flex items-center justify-end gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onViewInstances(ride)}
              title="Pregled Instanci"
            >
              <Eye className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" onClick={() => onEdit(ride)}>
              <Pencil className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onDelete(ride)}
              className="text-danger hover:text-danger hover:bg-danger/10"
              disabled={ride.status === "cancelled"}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        )
      },
    },
  ]
}
