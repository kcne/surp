"use client"

import { useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import Image from "next/image"
import { format } from "date-fns"
import { srLatn } from "date-fns/locale"
import {
  getCoreRowModel,
  getFilteredRowModel,
  useReactTable,
  type ColumnDef,
  type ColumnFiltersState,
  type FilterFn,
} from "@tanstack/react-table"
import { formatDateDisplay, formatTimeDisplay } from "@/utils/dateHelpers"
import type { RideInstance, RideStatus } from "@/types"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Calendar } from "@/components/ui/calendar"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { LineRoute } from "@/components/lines/LineRoute"
import { useRidesStore } from "@/stores/ridesStore"
import { useReservationsStore } from "@/stores/reservationsStore"
import { Armchair, CalendarDays, Clock3, Filter, Info, Route, Search, Ticket, X } from "lucide-react"

interface RidesListPanelProps {
  selectedDate: Date | undefined
  rideInstances: RideInstance[]
  loading: boolean
}

const statusLabels: Record<RideStatus, string> = {
  scheduled: "Zakazana",
  completed: "Završena",
  cancelled: "Otkazana",
}

const globalRideFilter: FilterFn<RideInstance> = (row, _columnId, filterValue) => {
  if (!filterValue) return true
  const term = String(filterValue).toLowerCase().trim()
  if (!term) return true

  const rideName = row.original.ride.line.name.toLowerCase()
  const lineName = row.original.ride.line.name.toLowerCase()
  const departureStation = row.original.ride.line.departureStation.name.toLowerCase()
  const arrivalStation = row.original.ride.line.arrivalStation.name.toLowerCase()
  return (
    rideName.includes(term) ||
    lineName.includes(term) ||
    departureStation.includes(term) ||
    arrivalStation.includes(term)
  )
}

const statusFilterFn: FilterFn<RideInstance> = (row, _columnId, value) => {
  const selected = value as RideStatus[]
  if (!selected?.length) return true
  return selected.includes(row.original.status)
}

export function RidesListPanel({
  selectedDate,
  rideInstances,
  loading,
}: RidesListPanelProps) {
  const router = useRouter()
  const { fetchRideInstances, setSelectedDate } = useRidesStore()
  const allReservations = useReservationsStore((state) => state.allReservations)
  const [infoModalOpen, setInfoModalOpen] = useState(false)
  const [selectedInstance, setSelectedInstance] = useState<RideInstance | null>(null)
  const [searchValue, setSearchValue] = useState("")
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([])

  const selectedInstanceReservations = useMemo(() => {
    if (!selectedInstance) return []
    return (allReservations[selectedInstance.id] || []).filter(
      (reservation) => reservation.status === "active"
    )
  }, [allReservations, selectedInstance])

  const isDateInPast = (date: Date) => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const candidate = new Date(date)
    candidate.setHours(0, 0, 0, 0)

    return candidate < today
  }

  const isRideInstanceInPast = (instance: RideInstance) => {
    const rideDate = new Date(`${instance.date}T00:00:00`)
    return isDateInPast(rideDate)
  }

  const handleViewSeats = (rideInstance: RideInstance) => {
    router.push(`/reservations/${rideInstance.id}`)
  }

  const handleDateSelect = (date: Date | undefined) => {
    if (date && date instanceof Date && !Number.isNaN(date.getTime())) {
      if (isDateInPast(date)) {
        return
      }
      setSelectedDate(date)
      fetchRideInstances(date)
    }
  }

  const columns = useMemo<ColumnDef<RideInstance>[]>(
    () => [
      {
        accessorKey: "status",
        filterFn: statusFilterFn,
      },
    ],
    []
  )

  const table = useReactTable({
    data: rideInstances,
    columns,
    state: {
      globalFilter: searchValue,
      columnFilters,
    },
    globalFilterFn: globalRideFilter,
    onGlobalFilterChange: setSearchValue,
    onColumnFiltersChange: setColumnFilters,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
  })

  const selectedStatuses =
    (columnFilters.find((filter) => filter.id === "status")?.value as RideStatus[]) || []

  const toggleStatus = (status: RideStatus) => {
    const next = selectedStatuses.includes(status)
      ? selectedStatuses.filter((value) => value !== status)
      : [...selectedStatuses, status]

    setColumnFilters((prev) => {
      const filtered = prev.filter((filter) => filter.id !== "status")
      return next.length ? [...filtered, { id: "status", value: next }] : filtered
    })
  }

  const clearFilters = () => {
    setSearchValue("")
    setColumnFilters([])
  }

  const formatDuration = (durationInMinutes?: number) => {
    if (!durationInMinutes || durationInMinutes <= 0) return null

    const hours = Math.floor(durationInMinutes / 60)
    const minutes = durationInMinutes % 60

    if (hours > 0 && minutes > 0) {
      return `${hours} sati ${minutes} min`
    }

    if (hours > 0) {
      return `${hours} sati`
    }

    return `${minutes} min`
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl border bg-card/70 p-4 shadow-sm">
        <div className="grid gap-3 md:grid-cols-[1.2fr_0.9fr_auto] md:items-center">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={searchValue}
              onChange={(event) => setSearchValue(event.target.value)}
              placeholder="Pretraži vožnju"
              className="pl-9"
            />
          </div>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className="w-full justify-start text-muted-foreground">
                <CalendarDays className="mr-2 h-4 w-4" />
                {selectedDate
                  ? format(selectedDate, "d. MMMM yyyy", { locale: srLatn })
                  : "Datum polaska"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-2" align="start">
              <Calendar
                mode="single"
                selected={selectedDate}
                onSelect={handleDateSelect}
                locale={srLatn}
                disabled={(date) => isDateInPast(date)}
                className="rounded-md border"
                classNames={{
                  months: "flex flex-col space-y-2",
                  month: "space-y-2",
                  nav: "absolute left-1/2 top-8 z-10 flex w-52 -translate-x-1/2 items-center justify-between",
                  month_caption: "flex h-8 items-center justify-center text-sm font-semibold",
                  button_previous: "h-7 w-7",
                  button_next: "h-7 w-7",
                  caption_label: "text-sm font-semibold",
                  table: "w-full border-collapse",
                  head_row: "flex",
                  head_cell: "text-muted-foreground rounded-md w-8 text-[0.7rem] font-medium",
                  row: "flex w-full mt-1.5",
                  cell: "h-8 w-8 text-center text-xs p-0 relative focus-within:z-20",
                  day: "h-8 w-8 p-0 text-xs font-medium aria-selected:opacity-100",
                }}
              />
            </PopoverContent>
          </Popover>
          <div className="flex flex-wrap items-center justify-start gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm">
                  <Filter className="mr-2 h-4 w-4" />
                  Filters
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-44">
                <DropdownMenuLabel>Prikazi</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {(Object.keys(statusLabels) as RideStatus[]).map((status) => (
                  <DropdownMenuCheckboxItem
                    key={status}
                    checked={selectedStatuses.includes(status)}
                    onCheckedChange={() => toggleStatus(status)}
                  >
                    {statusLabels[status]}
                  </DropdownMenuCheckboxItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
            {(searchValue || columnFilters.length > 0) && (
              <Button variant="ghost" size="sm" onClick={clearFilters}>
                <X className="mr-2 h-4 w-4" />
                Reset
              </Button>
            )}
            <div className="rounded-md border bg-background px-3 py-1 text-xs text-muted-foreground">
              {table.getRowModel().rows.length} vožnji
            </div>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="space-y-3">
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
        </div>
      ) : table.getRowModel().rows.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed p-12 text-center">
          <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-muted">
            <Ticket className="h-5 w-5 text-muted-foreground" />
          </div>
          <p className="text-lg font-medium text-muted-foreground">
            Nema zakazanih vožnji
          </p>
          <p className="text-sm text-muted-foreground">
            Nema vožnji za izabrani datum ili filtere
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {table.getRowModel().rows.map((row) => {
            const instance = row.original
            const capacity = instance.ride.busCapacity
            const reserved = instance.reservationCount || 0
            const available = capacity - reserved
            const durationLabel = formatDuration(instance.ride.line.duration)
            const isPastRide = isRideInstanceInPast(instance)

            return (
              <div
                key={row.id}
                className="w-full rounded-lg border bg-background p-4 shadow-sm"
              >
                <div className="grid gap-5 md:grid-cols-[auto_1.6fr_1fr_1fr_auto] md:items-center">
                  <div className="flex justify-start">
                    <Image
                      src="/uvs-logo.svg"
                      alt="Company logo"
                      width={132}
                      height={32}
                      className="h-8 w-auto"
                    />
                  </div>

                  <div className="space-y-1">
                    <p className="inline-flex items-center gap-1 text-xs font-semibold uppercase text-muted-foreground">
                      <Route className="h-3.5 w-3.5" />
                      Vožnja:
                    </p>
                    <p className="text-base font-semibold">
                      {instance.ride.line.departureStation.name} -&gt; {instance.ride.line.arrivalStation.name}
                    </p>
                  </div>

                  <div className="space-y-1">
                    <p className="inline-flex items-center gap-1 text-xs font-semibold uppercase text-muted-foreground">
                      <Clock3 className="h-3.5 w-3.5" />
                      Vreme:
                    </p>
                    <p className="text-base font-semibold">{formatTimeDisplay(instance.departureTime)}</p>
                    {durationLabel && (
                      <p className="text-sm text-muted-foreground">({durationLabel})</p>
                    )}
                  </div>

                  <div className="space-y-1">
                    <p className="inline-flex items-center gap-1 text-xs font-semibold uppercase text-muted-foreground">
                      <Armchair className="h-3.5 w-3.5" />
                      Slobodno:
                    </p>
                    <p className="text-base font-semibold">{available}/35</p>
                  </div>

                  <div className="space-y-2">
                    <div className="flex flex-col gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setSelectedInstance(instance)
                        setInfoModalOpen(true)
                      }}
                    >
                      <Info className="mr-2 h-4 w-4" />
                      Više informacija
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => handleViewSeats(instance)}
                      disabled={instance.status === "cancelled" || isPastRide}
                      title={isPastRide ? "Rezervacija za prošle vožnje nije moguća" : undefined}
                    >
                      <Ticket className="mr-2 h-4 w-4" />
                      Rezerviši
                    </Button>
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      <Dialog open={infoModalOpen} onOpenChange={setInfoModalOpen}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>Više informacija</DialogTitle>
            <DialogDescription>
              {selectedInstance?.ride.line.name}
            </DialogDescription>
          </DialogHeader>
          {selectedInstance && (
            <div className="space-y-4">
              <div className="grid gap-3 rounded-lg border bg-muted/30 p-4 sm:grid-cols-2">
                <p className="text-sm">
                  Datum: <span className="font-medium">{formatDateDisplay(selectedInstance.date)}</span>
                </p>
                <p className="text-sm">
                  Vreme: <span className="font-medium">{formatTimeDisplay(selectedInstance.departureTime)}</span>
                </p>
                <p className="text-sm">
                  Status: <span className="font-medium">{statusLabels[selectedInstance.status]}</span>
                </p>
                <p className="text-sm">
                  Putnika: <span className="font-medium">{selectedInstanceReservations.length}</span>
                </p>
              </div>

              <div className="rounded-lg border bg-muted/30 p-4">
                <p className="mb-3 text-sm font-semibold">Ruta</p>
                <LineRoute line={selectedInstance.ride.line} />
              </div>

              <div className="rounded-lg border p-4">
                <p className="mb-3 text-sm font-semibold">Lista putnika</p>
                {selectedInstanceReservations.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Nema rezervisanih putnika za ovu vožnju.</p>
                ) : (
                  <div className="space-y-2">
                    {selectedInstanceReservations.map((reservation) => (
                      <div
                        key={reservation.id}
                        className="flex items-center justify-between rounded-md border bg-muted/20 px-3 py-2 text-sm"
                      >
                        <span className="font-medium">
                          {reservation.passenger.firstName} {reservation.passenger.lastName}
                        </span>
                        <span className="text-muted-foreground">
                          Sedište {reservation.seatNumber} • {reservation.departureStation.name} → {reservation.arrivalStation.name}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
