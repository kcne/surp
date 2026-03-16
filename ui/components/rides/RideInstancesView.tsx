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
import { Ban, ChevronDown, Ticket } from "lucide-react"
import { formatDateToISO, generateRideInstanceDates } from "@/utils/dateHelpers"

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

  const instances = useMemo(() => {
    const generatedInstances: RideInstance[] = []

    if (activeRide.type === "recurring") {
      if (!activeRide.startDate || !activeRide.daysOfWeek || activeRide.daysOfWeek.length === 0) {
        return generatedInstances
      }

      const startDate = new Date(`${activeRide.startDate}T00:00:00`)
      const endDate = activeRide.endDate ? new Date(`${activeRide.endDate}T00:00:00`) : null
      const threeMonthsFromNow = new Date()
      threeMonthsFromNow.setMonth(threeMonthsFromNow.getMonth() + 3)

      const effectiveEndDate =
        endDate && endDate < threeMonthsFromNow ? endDate : threeMonthsFromNow

      const dates = generateRideInstanceDates(startDate, effectiveEndDate, activeRide.daysOfWeek)

      dates.forEach((date) => {
        const dateString = formatDateToISO(date)
        const exception = activeRide.exceptions?.find((ex) => ex.date === dateString)

        if (exception?.type === "skip") {
          return
        }

        const dayOfWeek = date.getDay()

        let departureTime: string | undefined
        let arrivalTime: string | undefined

        if (exception?.type === "additional") {
          departureTime = exception.departureTime
          arrivalTime = exception.arrivalTime
        } else if (activeRide.dayTimes && activeRide.dayTimes[dayOfWeek]) {
          departureTime = activeRide.dayTimes[dayOfWeek].departureTime
          arrivalTime = activeRide.dayTimes[dayOfWeek].arrivalTime
        } else if (activeRide.departureTime && activeRide.arrivalTime) {
          departureTime = activeRide.departureTime
          arrivalTime = activeRide.arrivalTime
        }

        if (!departureTime || !arrivalTime) {
          return
        }

        generatedInstances.push({
          id: `${activeRide.id}-${dateString}`,
          rideId: activeRide.id,
          ride: activeRide,
          date: dateString,
          departureTime,
          arrivalTime,
          status: activeRide.status,
          reservationCount: 0,
          availableSeats: activeRide.busCapacity,
        })
      })
    } else if (
      activeRide.type === "one-time" &&
      activeRide.date &&
      activeRide.oneTimeDepartureTime &&
      activeRide.oneTimeArrivalTime
    ) {
      generatedInstances.push({
        id: `${activeRide.id}-${activeRide.date}`,
        rideId: activeRide.id,
        ride: activeRide,
        date: activeRide.date,
        departureTime: activeRide.oneTimeDepartureTime,
        arrivalTime: activeRide.oneTimeArrivalTime,
        status: activeRide.status,
        reservationCount: 0,
        availableSeats: activeRide.busCapacity,
      })
    }

    return generatedInstances
  }, [activeRide])
    const handleReserve = async (instanceId: string, instanceDate: string) => {
      onOpenChange(false)
      router.push(`/reservations/${instanceId}?date=${instanceDate}`)
    }

    const handleCancelInstance = async (instanceDate: string) => {
      const maybeUpdatedRide = await onCancelInstance(activeRide, instanceDate)

      if (maybeUpdatedRide) {
        setActiveRide(maybeUpdatedRide)
      }
    }

  const [visibleCount, setVisibleCount] = useState(10)
  const [fromDate, setFromDate] = useState("")
  const [toDate, setToDate] = useState("")

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
      const today = new Date()
      const todayISO = today.toISOString().slice(0, 10)
      setFromDate(todayISO)
      setToDate("")
    }
  }, [open, ride.id])

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
            Generisane instance vožnje za naredna 3 meseca
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

          {allInstances.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-lg border border-dashed p-12">
              <p className="text-lg font-medium text-muted-foreground">
                Nema generisanih instanci
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
                        {instance.availableSeats ?? activeRide.busCapacity}/{activeRide.busCapacity}
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
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => handleCancelInstance(instance.date)}
                            disabled={loading || isPastInstance(instance.date)}
                          >
                            <Ban className="mr-2 h-4 w-4" />
                            Otkaži
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          {filteredInstances.length > visibleCount && (
            <div className="flex justify-center">
              <Button
                type="button"
                variant="outline"
                onClick={() => setVisibleCount((prev) => prev + 10)}
              >
                <ChevronDown className="mr-2 h-4 w-4" />
                Prikaži još
              </Button>
            </div>
          )}

          <div className="text-sm text-muted-foreground">
            Ukupno instanci: {filteredInstances.length}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}










