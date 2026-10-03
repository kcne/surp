"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import { ArrowLeft, Ban, RotateCcw } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import type { DepartureResponseDto } from "@/infrastructure/generated/model"
import { useDepartureRangeQuery } from "@/infrastructure/hooks/queries/useDeparturesQuery"
import { useRestoreDepartureMutation } from "@/infrastructure/hooks/mutations/useDepartureMutations"
import { addDaysToIsoDate } from "@/utils/departureWindows"
import { formatDateToISO, formatTimeDisplay } from "@/utils/dateHelpers"

/** Operator decisions reach no further than 365 days ahead. */
const HORIZON_DAYS = 365

/**
 * A departure an operator cancelled and can bring back. Dropped departures
 * are the timetable's doing and stay on the `reservation.reachable` check;
 * LEGACY rows never ran as a bus anyone can restore.
 */
export function isRestorableCancellation(departure: DepartureResponseDto): boolean {
  return departure.cancelledAt !== null && departure.source !== "LEGACY"
}

function formatServiceDate(date: string): string {
  return new Date(`${date}T00:00:00`).toLocaleDateString("sr-Latn-RS", {
    weekday: "short",
    day: "numeric",
    month: "long",
    year: "numeric",
  })
}

function formatCancelledAt(value: string): string {
  return new Date(value).toLocaleString("sr-Latn-RS", {
    day: "numeric",
    month: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

/**
 * Future departures an operator cancelled, each with "Vrati" (#27, PR 4c).
 * Every other screen lists running departures only, so this is the one
 * place a cancelled bus can be found and restored.
 */
export function CancelledDeparturesView() {
  const today = useMemo(() => formatDateToISO(new Date()), [])
  const range = useMemo(() => ({ from: today, to: addDaysToIsoDate(today, HORIZON_DAYS) }), [today])
  const departuresQuery = useDepartureRangeQuery(range)
  const restore = useRestoreDepartureMutation()
  const [restoringId, setRestoringId] = useState<string | null>(null)

  const cancelled = useMemo(
    () =>
      departuresQuery.departures
        .filter(isRestorableCancellation)
        .sort(
          (left, right) =>
            left.serviceDate.localeCompare(right.serviceDate) ||
            left.departureTime.localeCompare(right.departureTime) ||
            left.lineName.localeCompare(right.lineName)
        ),
    [departuresQuery.departures]
  )

  const handleRestore = async (departure: DepartureResponseDto) => {
    setRestoringId(departure.id)

    try {
      await restore.mutateAsync(departure.id)
    } catch {
      // The mutation has shown the server's sentence and refetched.
    } finally {
      setRestoringId(null)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold">
            <Ban className="h-6 w-6 text-primary" />
            Otkazani polasci
          </h1>
          <p className="text-muted-foreground">
            Polasci koje je osoblje otkazalo, od danas do {range.to}. Putnici ostaju na otkazanom
            polasku dok ih ne premestite ili otkazete.
          </p>
        </div>
        <Button asChild variant="outline">
          <Link href="/schedule">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Raspored
          </Link>
        </Button>
      </div>

      {departuresQuery.isError ? (
        <div
          role="alert"
          className="flex items-center justify-between gap-3 rounded-lg border border-destructive/50 p-4 text-sm text-destructive"
        >
          <span>Polasci nisu mogli biti ucitani.</span>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => void departuresQuery.refetch()}
            disabled={departuresQuery.isFetching}
          >
            Pokusaj ponovo
          </Button>
        </div>
      ) : departuresQuery.isLoading ? (
        <div className="space-y-2" role="status" aria-busy="true" aria-label="Ucitavanje polazaka">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
        </div>
      ) : cancelled.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed p-12">
          <Ban className="mb-3 h-10 w-10 text-muted-foreground" />
          <p className="text-lg font-medium text-muted-foreground">Nema otkazanih polazaka</p>
          <p className="text-sm text-muted-foreground">
            Polasci se otkazuju iz rasporeda voznje, dugmetom &quot;Otkazi&quot;.
          </p>
        </div>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Datum</TableHead>
                <TableHead>Vreme</TableHead>
                <TableHead>Linija</TableHead>
                <TableHead>Vrsta</TableHead>
                <TableHead>Putnici</TableHead>
                <TableHead>Otkazan</TableHead>
                <TableHead className="text-right">Akcije</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {cancelled.map((departure) => (
                <TableRow key={departure.id}>
                  <TableCell className="font-medium">{formatServiceDate(departure.serviceDate)}</TableCell>
                  <TableCell>
                    {formatTimeDisplay(departure.departureTime)} - {formatTimeDisplay(departure.arrivalTime)}
                  </TableCell>
                  <TableCell>{departure.lineName}</TableCell>
                  <TableCell>
                    <Badge variant={departure.source === "EXTRA" ? "secondary" : "outline"}>
                      {departure.source === "EXTRA" ? "Dodatni" : "Redovni"}
                    </Badge>
                  </TableCell>
                  <TableCell>{departure.activeReservationCount}</TableCell>
                  <TableCell>{departure.cancelledAt ? formatCancelledAt(departure.cancelledAt) : ""}</TableCell>
                  <TableCell className="text-right">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      aria-label={`Vrati polazak ${departure.serviceDate} u ${departure.departureTime}, ${departure.lineName}`}
                      onClick={() => handleRestore(departure)}
                      disabled={restore.isPending}
                    >
                      <RotateCcw className="mr-2 h-4 w-4" />
                      {restoringId === departure.id ? "Vracanje..." : "Vrati"}
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  )
}
