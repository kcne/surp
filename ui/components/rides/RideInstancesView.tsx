"use client"

import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import type { Ride, RideInstance } from "@/types"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Button } from "@/components/ui/button"
import { formatTimeDisplay } from "@/utils/dateHelpers"
import { formatDaysOfWeek } from "@/utils/formatters"
import { Input } from "@/components/ui/input"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Ban, ChevronDown, Pencil, Plus, Ticket, Trash2 } from "lucide-react"
import { useRunningDeparturesQuery } from "@/infrastructure/hooks/queries/useDeparturesQuery"
import {
  useCancelDepartureMutation,
  useCreateExtraDepartureMutation,
  useDeleteExtraDepartureMutation,
  useUpdateExtraDepartureMutation,
} from "@/infrastructure/hooks/mutations/useDepartureMutations"
import { useConfirmableUpdate } from "@/infrastructure/hooks/useConfirmableUpdate"
import { ConfirmBreakingChangeDialog } from "@/components/data-integrity/ConfirmBreakingChangeDialog"
import { ConfirmDeleteDialog } from "@/components/ui/confirm-delete-dialog"
import { ExtraDepartureDialog, type ExtraDepartureValues } from "@/components/rides/ExtraDepartureDialog"
import { addDaysToIsoDate, DEPARTURE_WINDOW_DAYS } from "@/utils/departureWindows"
import { formatDateToISO } from "@/utils/dateHelpers"
import { cancellingDeletesRide } from "@/utils/rideInstanceHelpers"

/** Bookings and operator decisions reach no further than 365 days ahead. */
const HORIZON_DAYS = 365

interface RideInstancesViewProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  ride: Ride
  loading: boolean
  /**
   * Cancelling the only bus of a one-time ride deletes the ride, as it always
   * has; every other cancellation is an operation on the departure.
   */
  onDeleteRide: (ride: Ride) => Promise<void>
}

type ConfirmableOperation =
  | { kind: "cancel"; id: string }
  | { kind: "updateExtra"; id: string; changes: Partial<Omit<ExtraDepartureValues, "serviceDate">> }

type ExtraDialogState =
  | { mode: "create"; values: ExtraDepartureValues }
  | { mode: "edit"; id: string; values: ExtraDepartureValues }

/** The changed fields of an edited extra, so an untouched time is not resent. */
function extraChanges(before: ExtraDepartureValues, after: ExtraDepartureValues) {
  return {
    ...(after.departureTime !== before.departureTime ? { departureTime: after.departureTime } : {}),
    ...(after.arrivalTime !== before.arrivalTime ? { arrivalTime: after.arrivalTime } : {}),
    ...(after.capacity !== before.capacity ? { capacity: after.capacity } : {}),
  }
}

export function RideInstancesView({
  open,
  onOpenChange,
  ride,
  loading,
  onDeleteRide,
}: RideInstancesViewProps) {
  const router = useRouter()
  const cancelDeparture = useCancelDepartureMutation()
  const createExtra = useCreateExtraDepartureMutation()
  const updateExtra = useUpdateExtraDepartureMutation()
  const deleteExtra = useDeleteExtraDepartureMutation()
  const [extraDialog, setExtraDialog] = useState<ExtraDialogState | null>(null)
  const [extraToDelete, setExtraToDelete] = useState<RideInstance | null>(null)
  const operationPending =
    loading ||
    cancelDeparture.isPending ||
    createExtra.isPending ||
    updateExtra.isPending ||
    deleteExtra.isPending

  // A cancellation or a move of a booked bus is refused until the operator
  // has seen its passengers; the same dialog the timetable edits use asks.
  const confirmable = useConfirmableUpdate<ConfirmableOperation>({
    update: (operation, answers) =>
      operation.kind === "cancel"
        ? cancelDeparture.mutateAsync({ id: operation.id, answers })
        : updateExtra.mutateAsync({ id: operation.id, changes: operation.changes, answers }),
    onConfirmed: () => setExtraDialog(null),
  })

  const handleReserve = async (instanceId: string, instanceDate: string) => {
    onOpenChange(false)
    router.push(`/reservations/${instanceId}?date=${instanceDate}`)
  }

  const handleCancelInstance = async (instance: RideInstance) => {
    try {
      if (instance.source !== "ADDITIONAL" && cancellingDeletesRide(ride)) {
        await onDeleteRide(ride)
        return
      }

      await confirmable.run({ kind: "cancel", id: instance.departureId ?? instance.id })
    } catch {
      // A refusal opens the confirmation dialog, and an ordinary failure has
      // already raised its toast. The list refetches and keeps showing the
      // bus as it still is.
    }
  }

  const submitExtra = async (values: ExtraDepartureValues) => {
    if (!extraDialog) {
      return
    }

    if (extraDialog.mode === "create") {
      await createExtra.mutateAsync({
        rideId: ride.id,
        serviceDate: values.serviceDate,
        departureTime: values.departureTime,
        arrivalTime: values.arrivalTime,
        capacity: values.capacity,
      })
      setExtraDialog(null)
      return
    }

    const changes = extraChanges(extraDialog.values, values)

    if (Object.keys(changes).length > 0) {
      await confirmable.run({ kind: "updateExtra", id: extraDialog.id, changes })
    }

    setExtraDialog(null)
  }

  const confirmDeleteExtra = async () => {
    if (!extraToDelete) {
      return
    }

    try {
      await deleteExtra.mutateAsync(extraToDelete.departureId ?? extraToDelete.id)
    } catch {
      // Reported by the mutation's toast.
    } finally {
      setExtraToDelete(null)
    }
  }

  const [visibleCount, setVisibleCount] = useState(10)
  const [fromDate, setFromDate] = useState("")
  const [toDate, setToDate] = useState("")
  const [loadedWindows, setLoadedWindows] = useState(1)

  // The ride's stored departures (#27, PR 4a), read 62 days at a time from
  // the "from" date; "show more" reads the next 62 days once the loaded ones
  // are all shown.
  const today = useMemo(() => formatDateToISO(new Date()), [])
  const rangeFrom = fromDate || today
  const rangeEnd = toDate || addDaysToIsoDate(today, HORIZON_DAYS)
  const loadedEnd = addDaysToIsoDate(rangeFrom, loadedWindows * DEPARTURE_WINDOW_DAYS - 1)
  const range = useMemo(
    () => ({ from: rangeFrom, to: loadedEnd < rangeEnd ? loadedEnd : rangeEnd }),
    [rangeFrom, loadedEnd, rangeEnd]
  )
  const hasUnloadedDates = range.to < rangeEnd
  const horizon = addDaysToIsoDate(today, HORIZON_DAYS)
  const rides = useMemo(() => [ride], [ride])
  const departuresQuery = useRunningDeparturesQuery(range, rides, {
    rideId: ride.id,
    enabled: open,
  })
  const instances = departuresQuery.instances

  const formatInstanceDate = (dateString: string) => {
    return new Date(`${dateString}T00:00:00`).toLocaleDateString("sr-Latn-RS", {
      day: "numeric",
      month: "long",
      year: "numeric",
    })
  }

  const allInstances = useMemo(() => {
    return [...instances].sort((a, b) => a.date.localeCompare(b.date))
  }, [instances])

  const filteredInstances = useMemo(() => {
    return allInstances.filter((instance) => {
      if (fromDate && instance.date < fromDate) {
        return false
      }

      if (toDate && instance.date > toDate) {
        return false
      }

      return true
    })
  }, [allInstances, fromDate, toDate])

  const isPastInstance = (dateString: string) => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const instanceDate = new Date(`${dateString}T00:00:00`)
    instanceDate.setHours(0, 0, 0, 0)
    return instanceDate < today
  }

  const visibleInstances = useMemo(
    () => filteredInstances.slice(0, visibleCount),
    [filteredInstances, visibleCount]
  )

  useEffect(() => {
    if (open) {
      setVisibleCount(10)
      setLoadedWindows(1)
      setFromDate(formatDateToISO(new Date()))
      setToDate("")
    }
  }, [open, ride.id])

  useEffect(() => {
    setLoadedWindows(1)
  }, [fromDate, toDate])

  const showMore = () => {
    if (filteredInstances.length > visibleCount) {
      setVisibleCount((prev) => prev + 10)
      return
    }

    setLoadedWindows((prev) => prev + 1)
    setVisibleCount((prev) => prev + 10)
  }

  const getStatusBadge = (status: string) => {
    const variants = {
      scheduled: "default",
      completed: "secondary",
      cancelled: "destructive",
    } as const

    const labels = {
      scheduled: "Zakazana",
      completed: "Završena",
      cancelled: "Otkazana",
    } as const

    return (
      <Badge variant={variants[status as keyof typeof variants]}>
        {labels[status as keyof typeof labels]}
      </Badge>
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="sm:max-w-[900px] max-h-[90vh] overflow-y-auto"
        onOpenAutoFocus={(event) => event.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle>Raspored vožnje: {ride.line.name}</DialogTitle>
          <DialogDescription>
            Polasci ove voznje od izabranog datuma
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="rounded-lg border p-4">
            <div className="space-y-2">
              <p className="text-sm">
                <span className="font-semibold">Linija:</span> {ride.line.name}
              </p>
              <p className="text-sm">
                <span className="font-semibold">Tip:</span>{" "}
                {ride.type === "recurring" ? "Ponavljajuća" : "Jednokratna"}
              </p>
              {ride.type === "recurring" && ride.daysOfWeek && (
                <p className="text-sm">
                  <span className="font-semibold">Dani:</span>{" "}
                  {formatDaysOfWeek(ride.daysOfWeek)}
                </p>
              )}
              <p className="text-sm">
                <span className="font-semibold">Kapacitet:</span> {ride.busCapacity} sedišta
              </p>
            </div>
          </div>

          <div className="flex justify-end">
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() =>
                setExtraDialog({
                  mode: "create",
                  values: {
                    serviceDate: fromDate && fromDate > today ? fromDate : today,
                    departureTime: "",
                    arrivalTime: "",
                    capacity: ride.busCapacity,
                  },
                })
              }
              disabled={operationPending}
            >
              <Plus className="mr-2 h-4 w-4" />
              Dodaj dodatni polazak
            </Button>
          </div>

          {/* Always shown: the range is what is read, so an empty one must stay changeable. */}
          <div className="grid gap-3 rounded-md border p-3 md:grid-cols-2">
            <div className="space-y-1">
              <label htmlFor="ride-instances-from" className="text-xs font-semibold uppercase text-muted-foreground">
                Od
              </label>
              <Input
                id="ride-instances-from"
                type="date"
                value={fromDate}
                onChange={(event) => setFromDate(event.target.value)}
              />
            </div>
            <div className="space-y-1">
              <label htmlFor="ride-instances-to" className="text-xs font-semibold uppercase text-muted-foreground">
                Do
              </label>
              <Input
                id="ride-instances-to"
                type="date"
                value={toDate}
                onChange={(event) => setToDate(event.target.value)}
              />
            </div>
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
          ) : departuresQuery.isLoading && allInstances.length === 0 ? (
            <div className="space-y-2" role="status" aria-busy="true" aria-label="Ucitavanje polazaka">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : allInstances.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-lg border border-dashed p-12">
              <p className="text-lg font-medium text-muted-foreground">
                {hasUnloadedDates ? "Nema polazaka u ucitanom periodu" : "Nema polazaka u izabranom periodu"}
              </p>
              <p className="text-sm text-muted-foreground">
                {hasUnloadedDates
                  ? "Ucitajte naredni period dugmetom ispod."
                  : "Promenite period ili proverite raspored voznje."}
              </p>
            </div>
          ) : (
            <div className="rounded-md border max-h-[420px] overflow-y-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Datum</TableHead>
                    <TableHead>Vreme Polaska</TableHead>
                    <TableHead>Vreme Dolaska</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Putnici</TableHead>
                    <TableHead className="text-right">Akcije</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {visibleInstances.map((instance) => (
                    <TableRow key={instance.id}>
                      <TableCell className="font-medium">
                        {formatInstanceDate(instance.date)}
                      </TableCell>
                      <TableCell>{formatTimeDisplay(instance.departureTime)}</TableCell>
                      <TableCell>{formatTimeDisplay(instance.arrivalTime)}</TableCell>
                      <TableCell>{getStatusBadge(instance.status)}</TableCell>
                      <TableCell>
                        {instance.availableSeats ?? instance.ride.busCapacity}/{instance.ride.busCapacity}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            type="button"
                            size="sm"
                            onClick={() => handleReserve(instance.id, instance.date)}
                            disabled={isPastInstance(instance.date)}
                          >
                            <Ticket className="mr-2 h-4 w-4" />
                            Rezerviši
                          </Button>
                          {instance.source === "ADDITIONAL" && (
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              aria-label={`Izmeni dodatni polazak ${instance.date} u ${instance.departureTime}`}
                              onClick={() =>
                                setExtraDialog({
                                  mode: "edit",
                                  id: instance.departureId ?? instance.id,
                                  values: {
                                    serviceDate: instance.date,
                                    departureTime: instance.departureTime,
                                    arrivalTime: instance.arrivalTime,
                                    capacity: instance.ride.busCapacity,
                                  },
                                })
                              }
                              disabled={operationPending || isPastInstance(instance.date)}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                          )}
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            aria-label={`Otkazi polazak ${instance.date} u ${instance.departureTime}`}
                            onClick={() => handleCancelInstance(instance)}
                            disabled={operationPending || isPastInstance(instance.date)}
                          >
                            <Ban className="mr-2 h-4 w-4" />
                            Otkaži
                          </Button>
                          {/* A booked extra is cancelled, never deleted: it is the record of the bus they were sold. */}
                          {instance.source === "ADDITIONAL" && !instance.reservationCount && (
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              aria-label={`Obrisi dodatni polazak ${instance.date} u ${instance.departureTime}`}
                              onClick={() => setExtraToDelete(instance)}
                              disabled={operationPending || isPastInstance(instance.date)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          {(filteredInstances.length > visibleCount || hasUnloadedDates) && (
            <div className="flex justify-center">
              <Button
                type="button"
                variant="outline"
                onClick={showMore}
                disabled={departuresQuery.isFetching}
              >
                <ChevronDown className="mr-2 h-4 w-4" />
                Prikaži još
              </Button>
            </div>
          )}

          <div className="text-sm text-muted-foreground">
            Ucitano polazaka: {filteredInstances.length}
          </div>
        </div>

        <ExtraDepartureDialog
          open={extraDialog !== null}
          onOpenChange={(next) => {
            if (!next) {
              setExtraDialog(null)
            }
          }}
          mode={extraDialog?.mode ?? "create"}
          initialValues={
            extraDialog?.values ?? { serviceDate: today, departureTime: "", arrivalTime: "", capacity: ride.busCapacity }
          }
          minDate={today}
          maxDate={horizon}
          loading={operationPending}
          onSubmit={submitExtra}
        />

        <ConfirmDeleteDialog
          open={extraToDelete !== null}
          onOpenChange={(next) => {
            if (!next) {
              setExtraToDelete(null)
            }
          }}
          title="Obrisati dodatni polazak?"
          description={
            extraToDelete
              ? `Dodatni polazak ${extraToDelete.date} u ${extraToDelete.departureTime} bice obrisan.`
              : ""
          }
          loading={deleteExtra.isPending}
          onConfirm={confirmDeleteExtra}
        />

        <ConfirmBreakingChangeDialog {...confirmable.dialogProps} loading={operationPending} />
      </DialogContent>
    </Dialog>
  )
}









