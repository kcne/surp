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
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
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
import { useReservationsByRideInstanceQuery } from "@/infrastructure/hooks/queries/useReservationsByRideInstanceQuery"
import { formatDateToISO, formatDuration } from "@/utils/dateHelpers"
import { generateRideInstancesForRide } from "@/utils/rideInstanceGenerators"
import {
  ArrowLeftRight,
  ArrowUpDown,
  CalendarDays,
  Check,
  ChevronsUpDown,
  Filter,
  Search,
  Ticket,
  X,
} from "lucide-react"

interface RidesListPanelProps {
  rides: Ride[]
  selectedDate: Date | undefined
  rideInstances: RideInstance[]
  loading: boolean
  onDateSelect: (date: Date) => void
}

const statusLabels: Record<RideStatus, string> = {
  scheduled: "Zakazana",
  completed: "Završena",
  cancelled: "Otkazana",
}

type SortKey = "departureAsc" | "departureDesc" | "availableDesc" | "availableAsc"

const sortLabels: Record<SortKey, string> = {
  departureAsc: "Polazak: rano → kasno",
  departureDesc: "Polazak: kasno → rano",
  availableDesc: "Najviše slobodnih mesta",
  availableAsc: "Najmanje slobodnih mesta",
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
  rides,
  selectedDate,
  rideInstances,
  loading,
  onDateSelect,
}: RidesListPanelProps) {
  const router = useRouter()
  const [infoModalOpen, setInfoModalOpen] = useState(false)
  const [selectedInstance, setSelectedInstance] = useState<RideInstance | null>(null)
  const [searchValue, setSearchValue] = useState("")
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([])
  const [selectedDepartureStationId, setSelectedDepartureStationId] = useState("")
  const [selectedArrivalStationId, setSelectedArrivalStationId] = useState("")
  const [departurePopoverOpen, setDeparturePopoverOpen] = useState(false)
  const [arrivalPopoverOpen, setArrivalPopoverOpen] = useState(false)
  const [sortKey, setSortKey] = useState<SortKey>("departureAsc")

  const selectedInstanceReservationsQuery = useReservationsByRideInstanceQuery(selectedInstance, {
    enabled: infoModalOpen && Boolean(selectedInstance),
  })

  const selectedInstanceReservations = useMemo(
    () =>
      (selectedInstanceReservationsQuery.data ?? []).filter(
        (reservation) => reservation.status === "active"
      ),
    [selectedInstanceReservationsQuery.data]
  )

  const isDateInPast = (date: Date) => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const candidate = new Date(date)
    candidate.setHours(0, 0, 0, 0)

    return candidate < today
  }

  const handleViewSeats = (rideInstance: RideInstance) => {
    const encodedRideInstanceId = encodeURIComponent(rideInstance.id)
    const encodedDate = encodeURIComponent(rideInstance.date)
    router.push(`/reservations/${encodedRideInstanceId}?date=${encodedDate}`)
  }

  const handleDateSelect = (date: Date | undefined) => {
    if (date && date instanceof Date && !Number.isNaN(date.getTime())) {
      if (isDateInPast(date)) {
        return
      }
      onDateSelect(date)
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

  const selectedStatuses = useMemo<RideStatus[]>(
    () =>
      (columnFilters.find((filter) => filter.id === "status")?.value as RideStatus[]) || [],
    [columnFilters],
  )

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

  /**
   * Set of YYYY-MM-DD strings for dates that have at least one ride matching
   * the current station + status filters. Drives calendar dot markers.
   */
  const availableDateKeys = useMemo(() => {
    const keys = new Set<string>()
    rides.forEach((ride) => {
      if (
        !matchesStationPair(
          ride.line,
          selectedDepartureStationId,
          selectedArrivalStationId,
        )
      ) {
        return
      }
      const instances = generateRideInstancesForRide(ride)
      instances.forEach((instance) => {
        if (selectedStatuses.length > 0 && !selectedStatuses.includes(instance.status)) {
          return
        }
        keys.add(instance.date)
      })
    })
    return keys
  }, [rides, selectedDepartureStationId, selectedArrivalStationId, selectedStatuses])

  const isDayWithRides = (date: Date) => availableDateKeys.has(formatDateToISO(date))

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

  const swapStations = () => {
    setSelectedDepartureStationId(selectedArrivalStationId)
    setSelectedArrivalStationId(selectedDepartureStationId)
  }

  const today = useMemo(() => {
    const date = new Date()
    date.setHours(0, 0, 0, 0)
    return date
  }, [])

  const tomorrow = useMemo(() => {
    const date = new Date(today)
    date.setDate(date.getDate() + 1)
    return date
  }, [today])

  const isSameDay = (left: Date | undefined, right: Date) => {
    if (!left) return false
    return (
      left.getFullYear() === right.getFullYear() &&
      left.getMonth() === right.getMonth() &&
      left.getDate() === right.getDate()
    )
  }

  const todaySelected = isSameDay(selectedDate, today)
  const tomorrowSelected = isSameDay(selectedDate, tomorrow)

  const filteredRows = table.getRowModel().rows

  const sortedRows = useMemo(() => {
    const rows = filteredRows.slice()
    const compare = (left: RideInstance, right: RideInstance) => {
      switch (sortKey) {
        case "departureDesc":
          return right.departureTime.localeCompare(left.departureTime)
        case "availableDesc": {
          const leftFree = left.ride.busCapacity - (left.reservationCount || 0)
          const rightFree = right.ride.busCapacity - (right.reservationCount || 0)
          return rightFree - leftFree
        }
        case "availableAsc": {
          const leftFree = left.ride.busCapacity - (left.reservationCount || 0)
          const rightFree = right.ride.busCapacity - (right.reservationCount || 0)
          return leftFree - rightFree
        }
        case "departureAsc":
        default:
          return left.departureTime.localeCompare(right.departureTime)
      }
    }
    rows.sort((a, b) => compare(a.original, b.original))
    return rows
  }, [filteredRows, sortKey])

  const hasActiveFilters =
    Boolean(searchValue) ||
    selectedStatuses.length > 0 ||
    Boolean(selectedDepartureStationId) ||
    Boolean(selectedArrivalStationId)

  return (
    <div className="space-y-4">
      <div className="rounded-xl border bg-card/70 p-4 shadow-sm">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-[1.4fr_2fr_1fr_auto] xl:items-center">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={searchValue}
              onChange={(event) => setSearchValue(event.target.value)}
              placeholder="Pretraži vožnju"
              className="pl-9"
            />
          </div>

          <div className="flex items-center gap-1.5">
            <Popover open={departurePopoverOpen} onOpenChange={setDeparturePopoverOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  aria-expanded={departurePopoverOpen}
                  className="w-full flex-1 justify-between"
                >
                  <span className="truncate">
                    {selectedDepartureStation?.name || "Polazna stanica"}
                  </span>
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

            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-9 w-9 shrink-0"
              onClick={swapStations}
              disabled={!selectedDepartureStationId && !selectedArrivalStationId}
              aria-label="Zameni polaznu i dolaznu stanicu"
              title="Zameni stanice"
            >
              <ArrowLeftRight className="h-4 w-4" />
            </Button>

            <Popover open={arrivalPopoverOpen} onOpenChange={setArrivalPopoverOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  aria-expanded={arrivalPopoverOpen}
                  className="w-full flex-1 justify-between"
                >
                  <span className="truncate">
                    {selectedArrivalStation?.name || "Dolazna stanica"}
                  </span>
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
                modifiers={{ hasRides: isDayWithRides }}
                modifiersClassNames={{
                  hasRides:
                    "relative after:absolute after:bottom-1 after:left-1/2 after:-translate-x-1/2 after:h-1 after:w-1 after:rounded-full after:bg-success after:content-['']",
                }}
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
              <div className="flex items-center justify-center gap-1.5 px-2 pb-1 pt-2 text-[10px] text-muted-foreground">
                <span className="inline-block h-1.5 w-1.5 rounded-full bg-success" />
                <span>Datumi sa dostupnim vožnjama</span>
              </div>
            </PopoverContent>
          </Popover>

          <div className="flex flex-wrap items-center justify-start gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm">
                  <Filter className="mr-2 h-4 w-4" />
                  Filteri
                  {selectedStatuses.length > 0 && (
                    <span className="ml-2 rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-semibold text-primary-foreground">
                      {selectedStatuses.length}
                    </span>
                  )}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-44">
                <DropdownMenuLabel>Prikaži</DropdownMenuLabel>
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

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm">
                  <ArrowUpDown className="mr-2 h-4 w-4" />
                  Sortiraj
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>Sortiraj po</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuRadioGroup
                  value={sortKey}
                  onValueChange={(value) => setSortKey(value as SortKey)}
                >
                  {(Object.keys(sortLabels) as SortKey[]).map((key) => (
                    <DropdownMenuRadioItem key={key} value={key}>
                      {sortLabels[key]}
                    </DropdownMenuRadioItem>
                  ))}
                </DropdownMenuRadioGroup>
              </DropdownMenuContent>
            </DropdownMenu>

            <div className="rounded-md border bg-background px-3 py-1 text-xs font-medium tabular-nums text-muted-foreground">
              {sortedRows.length} vožnji
            </div>
          </div>
        </div>

        {(hasActiveFilters || todaySelected || tomorrowSelected || selectedDate) && (
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Brzi izbor:
            </span>
            <Button
              type="button"
              size="sm"
              variant={todaySelected ? "default" : "outline"}
              className="h-7 px-3 text-xs"
              onClick={() => onDateSelect(today)}
            >
              Danas
            </Button>
            <Button
              type="button"
              size="sm"
              variant={tomorrowSelected ? "default" : "outline"}
              className="h-7 px-3 text-xs"
              onClick={() => onDateSelect(tomorrow)}
            >
              Sutra
            </Button>

            {hasActiveFilters && (
              <>
                <span className="mx-1 h-4 w-px bg-border" aria-hidden="true" />
                {searchValue && (
                  <FilterChip
                    label={`Pretraga: "${searchValue}"`}
                    onRemove={() => setSearchValue("")}
                  />
                )}
                {selectedDepartureStation && (
                  <FilterChip
                    label={`Polazak: ${selectedDepartureStation.name}`}
                    onRemove={() => setSelectedDepartureStationId("")}
                  />
                )}
                {selectedArrivalStation && (
                  <FilterChip
                    label={`Dolazak: ${selectedArrivalStation.name}`}
                    onRemove={() => setSelectedArrivalStationId("")}
                  />
                )}
                {selectedStatuses.map((status) => (
                  <FilterChip
                    key={status}
                    label={statusLabels[status]}
                    onRemove={() => toggleStatus(status)}
                  />
                ))}
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 text-xs"
                  onClick={clearFilters}
                >
                  <X className="mr-1 h-3 w-3" />
                  Resetuj sve
                </Button>
              </>
            )}
          </div>
        )}
      </div>

      {loading ? (
        <div className="space-y-3">
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
        </div>
      ) : sortedRows.length === 0 ? (
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
          {hasActiveFilters && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="mt-4"
              onClick={clearFilters}
            >
              <X className="mr-2 h-4 w-4" />
              Resetuj filtere
            </Button>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {sortedRows.map((row) => {
            const instance = row.original
            const durationLabel = formatDuration(instance.ride.line.duration)

            return (
              <RideInstanceCard
                key={row.id}
                instance={instance}
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

interface FilterChipProps {
  label: string
  onRemove: () => void
}

function FilterChip({ label, onRemove }: FilterChipProps) {
  return (
    <span className="inline-flex h-7 items-center gap-1 rounded-full border bg-background px-2.5 text-xs font-medium">
      <span className="max-w-[180px] truncate">{label}</span>
      <button
        type="button"
        onClick={onRemove}
        className="-mr-1 inline-flex h-4 w-4 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
        aria-label={`Ukloni filter: ${label}`}
      >
        <X className="h-3 w-3" />
      </button>
    </span>
  )
}
