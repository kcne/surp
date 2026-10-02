"use client"

import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import type { Ride } from "@/types"
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
import { Ban, ChevronDown, Ticket } from "lucide-react"
import { useRunningDeparturesQuery } from "@/infrastructure/hooks/queries/useDeparturesQuery"
import { addDaysToIsoDate, DEPARTURE_WINDOW_DAYS } from "@/utils/departureWindows"
import { formatDateToISO } from "@/utils/dateHelpers"

/** Bookings and operator decisions reach no further than 365 days ahead. */
const HORIZON_DAYS = 365

interface RideInstancesViewProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  ride: Ride
  loading: boolean
  onCancelInstance: (ride: Ride, instanceDate: string) => Promise<Ride | void>
}

export function RideInstancesView({
  open,
  onOpenChange,
  ride,
  loading,
  onCancelInstance,
}: RideInstancesViewProps) {
  const router = useRouter()
  const [activeRide, setActiveRide] = useState<Ride>(ride)

  useEffect(() => {
    setActiveRide(ride)
  }, [ride])

    const handleReserve = async (instanceId: string, instanceDate: string) => {
      onOpenChange(false)
      router.push(`/reservations/${instanceId}?date=${instanceDate}`)
    }

    const handleCancelInstance = async (instanceDate: string) => {
      try {
        const maybeUpdatedRide = await onCancelInstance(activeRide, instanceDate)

        if (maybeUpdatedRide) {
          setActiveRide(maybeUpdatedRide)
        }
      } catch {
        // The page answers for this one: a refusal opens the confirmation
        // dialog and an ordinary failure has already raised its toast. What
        // matters here is that the list keeps showing the instance as it still
        // is — running — instead of marking it cancelled on a write that was
        // refused.
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
  const rides = useMemo(() => [activeRide], [activeRide])
  const departuresQuery = useRunningDeparturesQuery(range, rides, {
    rideId: activeRide.id,
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
                <span className="font-semibold">Linija:</span> {activeRide.line.name}
              </p>
              <p className="text-sm">
                <span className="font-semibold">Tip:</span>{" "}
                {activeRide.type === "recurring" ? "Ponavljajuća" : "Jednokratna"}
              </p>
              {activeRide.type === "recurring" && activeRide.daysOfWeek && (
                <p className="text-sm">
                  <span className="font-semibold">Dani:</span>{" "}
                  {formatDaysOfWeek(activeRide.daysOfWeek)}
                </p>
              )}
              <p className="text-sm">
                <span className="font-semibold">Kapacitet:</span> {activeRide.busCapacity} sedišta
              </p>
            </div>
          </div>

          {departuresQuery.isError ? (
            <div role="alert" className="rounded-lg border border-destructive/50 p-4 text-sm text-destructive">
              Polasci nisu mogli biti ucitani. Pokusajte ponovo.
            </div>
          ) : departuresQuery.isLoading && allInstances.length === 0 ? (
            <div className="space-y-2">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : allInstances.length === 0 && !hasUnloadedDates ? (
            <div className="flex flex-col items-center justify-center rounded-lg border border-dashed p-12">
              <p className="text-lg font-medium text-muted-foreground">
                Nema polazaka u izabranom periodu
              </p>
              <p className="text-sm text-muted-foreground">
                {ride.type === "recurring"
                  ? "Proverite da li su svi podaci za ponavljajuću vožnju popunjeni."
                  : "Jednokratna vožnja ima samo jednu instancu."}
              </p>
            </div>
          ) : (
            <div className="rounded-md border max-h-[420px] overflow-y-auto">
              <div className="grid gap-3 border-b p-3 md:grid-cols-2">
                <div className="space-y-1">
                  <p className="text-xs font-semibold uppercase text-muted-foreground">Od</p>
                  <Input type="date" value={fromDate} onChange={(event) => setFromDate(event.target.value)} />
                </div>
                <div className="space-y-1">
                  <p className="text-xs font-semibold uppercase text-muted-foreground">Do</p>
                  <Input type="date" value={toDate} onChange={(event) => setToDate(event.target.value)} />
                </div>
              </div>
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
                          {instance.source !== "ADDITIONAL" ? <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => handleCancelInstance(instance.date)}
                            disabled={loading || isPastInstance(instance.date)}
                          >
                            <Ban className="mr-2 h-4 w-4" />
                            Otkaži
                          </Button> : null}
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
      </DialogContent>
    </Dialog>
  )
}









