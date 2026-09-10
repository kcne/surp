"use client"

import Link from "next/link"
import { ClipboardList, Users } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { formatTimeDisplay } from "@/utils/dateHelpers"
import { cn } from "@/lib/utils"
import type { UpcomingRideListItem } from "@/hooks/usePassengerListsPage"

interface UpcomingRidesTableProps {
  items: UpcomingRideListItem[]
  /** Counts arrive after the schedule itself, so seats stay muted until then. */
  isCountsLoading: boolean
}

function formatInstanceDate(dateString: string): string {
  return new Date(`${dateString}T00:00:00`).toLocaleDateString("sr-Latn-RS", {
    day: "numeric",
    month: "long",
    year: "numeric",
  })
}

function passengerListHref(item: UpcomingRideListItem): string {
  const { rideInstance } = item
  return `/passenger-lists/${encodeURIComponent(rideInstance.rideId)}?date=${rideInstance.date}&departure=${encodeURIComponent(rideInstance.departureTime)}`
}

function OccupancyLabel({
  item,
  isCountsLoading,
}: {
  item: UpcomingRideListItem
  isCountsLoading: boolean
}) {
  const isFull = item.capacity > 0 && item.passengerCount >= item.capacity

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 font-medium tabular-nums",
        isCountsLoading && "text-muted-foreground",
        !isCountsLoading && isFull && "text-destructive"
      )}
    >
      <Users className="h-4 w-4 shrink-0" />
      {isCountsLoading ? "—" : `${item.passengerCount}/${item.capacity}`}
    </span>
  )
}

export function UpcomingRidesTable({ items, isCountsLoading }: UpcomingRidesTableProps) {
  return (
    <>
      {/* Desktop: the full schedule row. */}
      <div className="hidden overflow-x-auto rounded-md border md:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Vožnja</TableHead>
              <TableHead>Datum</TableHead>
              <TableHead>Vreme Polaska</TableHead>
              <TableHead>Vreme Dolaska</TableHead>
              <TableHead>Putnici</TableHead>
              <TableHead className="text-right">Akcije</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((item) => (
              <TableRow key={`${item.rideInstance.id}-${item.rideInstance.departureTime}`}>
                <TableCell className="font-medium">{item.rideInstance.ride.line.name}</TableCell>
                <TableCell>{formatInstanceDate(item.rideInstance.date)}</TableCell>
                <TableCell className="tabular-nums">
                  {formatTimeDisplay(item.rideInstance.departureTime)}
                </TableCell>
                <TableCell className="tabular-nums">
                  {formatTimeDisplay(item.rideInstance.arrivalTime)}
                </TableCell>
                <TableCell>
                  <OccupancyLabel item={item} isCountsLoading={isCountsLoading} />
                </TableCell>
                <TableCell className="text-right">
                  <Button asChild size="sm">
                    <Link href={passengerListHref(item)}>
                      <ClipboardList className="mr-2 h-4 w-4" />
                      Vidi Listu Putnika
                    </Link>
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Mobile: one card per ride, so a driver can read it on a phone. */}
      <div className="space-y-3 md:hidden">
        {items.map((item) => (
          <div
            key={`${item.rideInstance.id}-${item.rideInstance.departureTime}`}
            className="rounded-lg border bg-card p-4"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate font-medium">{item.rideInstance.ride.line.name}</p>
                <p className="text-sm text-muted-foreground">
                  {formatInstanceDate(item.rideInstance.date)}
                </p>
              </div>
              <OccupancyLabel item={item} isCountsLoading={isCountsLoading} />
            </div>

            <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
              <div>
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Polazak</p>
                <p className="tabular-nums">
                  {formatTimeDisplay(item.rideInstance.departureTime)}
                </p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Dolazak</p>
                <p className="tabular-nums">
                  {formatTimeDisplay(item.rideInstance.arrivalTime)}
                </p>
              </div>
            </div>

            <Button asChild className="mt-4 w-full">
              <Link href={passengerListHref(item)}>
                <ClipboardList className="mr-2 h-4 w-4" />
                Vidi Listu Putnika
              </Link>
            </Button>
          </div>
        ))}
      </div>
    </>
  )
}
