"use client"

import { useMemo, useState } from "react"
import { useRouter } from "next/navigation"
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
import type { Ride, RideInstance, RideStatus } from "@/types"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
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
import { RideInstanceCard } from "@/components/reservations/RideInstanceCard"
import { RideInstanceInfoDialog } from "@/components/reservations/RideInstanceInfoDialog"
import { cn } from "@/lib/utils"
import { useRidesStore } from "@/stores/ridesStore"
import { useReservationsStore } from "@/stores/reservationsStore"
import { CalendarDays, Check, ChevronsUpDown, Filter, Search, Ticket, X } from "lucide-react"

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
  const intermediateStations = row.original.ride.line.intermediateStations
    .map((station) => station.stationName.toLowerCase())
  return (
    rideName.includes(term) ||
    lineName.includes(term) ||
    departureStation.includes(term) ||
    arrivalStation.includes(term) ||
    intermediateStations.some((stationName) => stationName.includes(term))
  )
}

const statusFilterFn: FilterFn<RideInstance> = (row, _columnId, value) => {
  const selected = value as RideStatus[]
  if (!selected?.length) return true
  return selected.includes(row.original.status)
}

const getOrderedLineStations = (line: Ride["line"]) => {
  const intermediateStations = [...line.intermediateStations].sort(
    (left, right) => left.order - right.order
  )

  return [
    {
      id: line.departureStation.id,
      name: line.departureStation.name,
    },
    ...intermediateStations.map((station) => ({
      id: station.stationId,
      name: station.stationName,
    })),
    {
      id: line.arrivalStation.id,
      name: line.arrivalStation.name,
    },
  ]
}

const matchesStationPair = (
  line: Ride["line"],
  departureStationId: string,
  arrivalStationId: string
) => {
  const stationIds = getOrderedLineStations(line).map((station) => station.id)

  const departureIndex = departureStationId
    ? stationIds.findIndex((id) => id === departureStationId)
    : -1
  const arrivalIndex = arrivalStationId
    ? stationIds.findIndex((id) => id === arrivalStationId)
    : -1

  if (departureStationId && departureIndex === -1) return false
  if (arrivalStationId && arrivalIndex === -1) return false
  if (departureStationId && arrivalStationId && arrivalIndex <= departureIndex) return false

  return true
}

export function RidesListPanel({
  selectedDate,
  rideInstances,
  loading,
}: RidesListPanelProps) {
  const router = useRouter()
  const { rides, fetchRideInstances, setSelectedDate } = useRidesStore()
  const allReservations = useReservationsStore((state) => state.allReservations)
  const [infoModalOpen, setInfoModalOpen] = useState(false)
  const [selectedInstance, setSelectedInstance] = useState<RideInstance | null>(null)
  const [searchValue, setSearchValue] = useState("")
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([])
  const [selectedDepartureStationId, setSelectedDepartureStationId] = useState("")
  const [selectedArrivalStationId, setSelectedArrivalStationId] = useState("")
  const [departurePopoverOpen, setDeparturePopoverOpen] = useState(false)
  const [arrivalPopoverOpen, setArrivalPopoverOpen] = useState(false)

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

  const filteredRideInstances = useMemo(
    () =>
      rideInstances.filter((instance) =>
        matchesStationPair(instance.ride.line, selectedDepartureStationId, selectedArrivalStationId)
      ),
    [rideInstances, selectedDepartureStationId, selectedArrivalStationId]
  )

  const table = useReactTable({
    data: filteredRideInstances,
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

  const allStationOptions = useMemo(
    () =>
      Array.from(
        new Map(
          rides.flatMap((ride) =>
            getOrderedLineStations(ride.line).map((station) => [station.id, station])
          )
        ).values()
      ).sort((left, right) => left.name.localeCompare(right.name, "sr")),
    [rides]
  )

  const departureStationOptions = useMemo(
    () =>
      allStationOptions.filter((candidate) =>
        rides.some((ride) => {
          return matchesStationPair(ride.line, candidate.id, selectedArrivalStationId)
        })
      ),
    [allStationOptions, rides, selectedArrivalStationId]
  )

  const arrivalStationOptions = useMemo(
    () =>
      allStationOptions.filter((candidate) =>
        rides.some((ride) => {
          return matchesStationPair(ride.line, selectedDepartureStationId, candidate.id)
        })
      ),
    [allStationOptions, rides, selectedDepartureStationId]
  )

  const selectedDepartureStation = departureStationOptions.find(
    (station) => station.id === selectedDepartureStationId
  )

  const selectedArrivalStation = arrivalStationOptions.find(
    (station) => station.id === selectedArrivalStationId
  )

  const toggleStatus = (status: RideStatus) => {
    const next = selectedStatuses.includes(status)
      ? selectedStatuses.filter((value) => value !== status)
      : [...selectedStatuses, status]

    setColumnFilters((prev) => {
      const filtered = prev.filter((filter) => filter.id !== "status")
      return next.length ? [...filtered, { id: "status", value: next }] : filtered
    })
  }

  const setStationFilter = (
    filterId: "departureStationId" | "arrivalStationId",
    value: string
  ) => {
    if (filterId === "departureStationId") {
      setSelectedDepartureStationId(value)
      return
    }

    setSelectedArrivalStationId(value)
  }

  const clearFilters = () => {
    setSearchValue("")
    setColumnFilters([])
    setSelectedDepartureStationId("")
    setSelectedArrivalStationId("")
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
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-[1.2fr_1fr_1fr_0.9fr_auto] xl:items-center">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={searchValue}
              onChange={(event) => setSearchValue(event.target.value)}
              placeholder="Pretraži vožnju"
              className="pl-9"
            />
          </div>

          <Popover open={departurePopoverOpen} onOpenChange={setDeparturePopoverOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                role="combobox"
                aria-expanded={departurePopoverOpen}
                className="w-full justify-between"
              >
                {selectedDepartureStation?.name || "Polazna stanica"}
                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[320px] p-0" align="start">
              <Command>
                <CommandInput placeholder="Pretraži polaznu stanicu..." />
                <CommandList>
                  <CommandEmpty>Nema pronađenih stanica.</CommandEmpty>
                  <CommandGroup>
                    {departureStationOptions.map((station) => (
                      <CommandItem
                        key={station.id}
                        value={station.name}
                        onSelect={() => {
                          setStationFilter(
                            "departureStationId",
                            station.id === selectedDepartureStationId ? "" : station.id
                          )
                          setDeparturePopoverOpen(false)
                        }}
                      >
                        <Check
                          className={cn(
                            "mr-2 h-4 w-4",
                            selectedDepartureStationId === station.id ? "opacity-100" : "opacity-0"
                          )}
                        />
                        {station.name}
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>

          <Popover open={arrivalPopoverOpen} onOpenChange={setArrivalPopoverOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                role="combobox"
                aria-expanded={arrivalPopoverOpen}
                className="w-full justify-between"
              >
                {selectedArrivalStation?.name || "Dolazna stanica"}
                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[320px] p-0" align="start">
              <Command>
                <CommandInput placeholder="Pretraži dolaznu stanicu..." />
                <CommandList>
                  <CommandEmpty>Nema pronađenih stanica.</CommandEmpty>
                  <CommandGroup>
                    {arrivalStationOptions.map((station) => (
                      <CommandItem
                        key={station.id}
                        value={station.name}
                        onSelect={() => {
                          setStationFilter(
                            "arrivalStationId",
                            station.id === selectedArrivalStationId ? "" : station.id
                          )
                          setArrivalPopoverOpen(false)
                        }}
                      >
                        <Check
                          className={cn(
                            "mr-2 h-4 w-4",
                            selectedArrivalStationId === station.id ? "opacity-100" : "opacity-0"
                          )}
                        />
                        {station.name}
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>

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
            {(searchValue || columnFilters.length > 0 || selectedDepartureStationId || selectedArrivalStationId) && (
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
            const durationLabel = formatDuration(instance.ride.line.duration)
            const isPastRide = isRideInstanceInPast(instance)

            return (
              <RideInstanceCard
                key={row.id}
                instance={instance}
                isPastRide={isPastRide}
                durationLabel={durationLabel}
                onViewInfo={(value) => {
                  setSelectedInstance(value)
                  setInfoModalOpen(true)
                }}
                onReserve={handleViewSeats}
              />
            )
          })}
        </div>
      )}

      <RideInstanceInfoDialog
        open={infoModalOpen}
        onOpenChange={setInfoModalOpen}
        selectedInstance={selectedInstance}
        selectedInstanceReservations={selectedInstanceReservations}
        statusLabels={statusLabels}
      />
    </div>
  )
}
