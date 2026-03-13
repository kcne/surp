"use client"

import { useEffect, useMemo, useState } from "react"
import { Layout } from "@/components/layout/Layout"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Plus, Pencil, X, Eye, CalendarClock, Route, Tags, Settings2, Clock3, Search } from "lucide-react"
import { useRidesStore } from "@/stores/ridesStore"
import { RideModal } from "@/components/rides/RideModal"
import { DeleteRideDialog } from "@/components/rides/DeleteRideDialog"
import { RideInstancesView } from "@/components/rides/RideInstancesView"
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

export default function SchedulePage() {
  const { rides, loading, fetchRides } = useRidesStore()
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [isInstancesViewOpen, setIsInstancesViewOpen] = useState(false)
  const [selectedRide, setSelectedRide] = useState<Ride | null>(null)
  const [rideToDelete, setRideToDelete] = useState<Ride | null>(null)
  const [searchValue, setSearchValue] = useState("")

  useEffect(() => {
    fetchRides()
  }, [fetchRides])

  const handleEdit = (ride: Ride) => {
    setSelectedRide(ride)
    setIsModalOpen(true)
  }

  const handleDelete = (ride: Ride) => {
    setRideToDelete(ride)
    setIsDeleteDialogOpen(true)
  }

  const handleViewInstances = (ride: Ride) => {
    setSelectedRide(ride)
    setIsInstancesViewOpen(true)
  }

  const handleAddNew = () => {
    setSelectedRide(null)
    setIsModalOpen(true)
  }

  const handleModalClose = () => {
    setIsModalOpen(false)
    setSelectedRide(null)
  }

  const getTypeBadge = (type: Ride["type"]) => {
    return (
      <Badge variant={type === "recurring" ? "default" : "secondary"}>
        {type === "recurring" ? "Ponavljajuća" : "Jednokratna"}
      </Badge>
    )
  }

  const scheduledRides = rides.filter((ride) => ride.status === "scheduled")

  const filteredScheduledRides = useMemo(() => {
    const term = searchValue.trim().toLowerCase()
    if (!term) return scheduledRides

    return scheduledRides.filter((ride) => {
      const rideTypeLabel = ride.type === "recurring" ? "ponavljajuća" : "jednokratna"
      return `${ride.line.name} ${rideTypeLabel}`.toLowerCase().includes(term)
    })
  }, [scheduledRides, searchValue])

  const getDepartureForDay = (ride: Ride, dayValue: number) => {
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

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="flex items-center gap-2 text-2xl font-bold">
              <CalendarClock className="h-6 w-6 text-primary" />
              Raspored Vožnji
            </h1>
            <p className="text-muted-foreground">
              Upravljajte rasporedom autobuskih vožnji
            </p>
          </div>
          <Button onClick={handleAddNew}>
            <Plus className="mr-2 h-4 w-4" />
            Dodaj Vožnju
          </Button>
        </div>

        {loading && rides.length === 0 ? (
          <div className="space-y-4">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
          </div>
        ) : scheduledRides.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-lg border border-dashed p-12">
            <CalendarClock className="mb-3 h-10 w-10 text-muted-foreground" />
            <p className="text-lg font-medium text-muted-foreground">
              Nema zakazanih vožnji
            </p>
            <p className="mb-4 text-sm text-muted-foreground">
              Dodajte raspored da biste počeli
            </p>
            <Button onClick={handleAddNew}>
              <Plus className="mr-2 h-4 w-4" />
              Dodaj Vožnju
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="rounded-xl border bg-card/70 p-4 shadow-sm">
              <div className="grid gap-3 md:grid-cols-[1fr_auto] md:items-center">
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={searchValue}
                    onChange={(event) => setSearchValue(event.target.value)}
                    placeholder="Pretraži raspored"
                    className="pl-9"
                  />
                </div>
                <div className="rounded-md border bg-background px-3 py-1 text-xs text-muted-foreground">
                  {filteredScheduledRides.length} vožnji
                </div>
              </div>
            </div>

            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>
                      <span className="inline-flex items-center gap-1">
                        <Route className="h-4 w-4 text-muted-foreground" />
                        Linija
                      </span>
                    </TableHead>
                    <TableHead>
                      <span className="inline-flex items-center gap-1">
                        <Tags className="h-4 w-4 text-muted-foreground" />
                        Tip
                      </span>
                    </TableHead>
                    {DAYS_OF_WEEK.map((day) => (
                      <TableHead key={day.value}>
                        <span className="inline-flex items-center gap-1">
                          <Clock3 className="h-3.5 w-3.5 text-muted-foreground" />
                          {day.label}
                        </span>
                      </TableHead>
                    ))}
                    <TableHead className="text-right">
                      <span className="inline-flex items-center justify-end gap-1">
                        <Settings2 className="h-4 w-4 text-muted-foreground" />
                        Akcije
                      </span>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredScheduledRides.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={10} className="py-8 text-center text-muted-foreground">
                        Nema rezultata za uneti pojam
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredScheduledRides.map((ride) => (
                      <TableRow key={ride.id}>
                        <TableCell className="font-semibold text-primary">{ride.line.name}</TableCell>
                        <TableCell>{getTypeBadge(ride.type)}</TableCell>
                        {DAYS_OF_WEEK.map((day) => (
                          <TableCell key={`${ride.id}-${day.value}`}>
                            {getDepartureForDay(ride, day.value)}
                          </TableCell>
                        ))}
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleViewInstances(ride)}
                              title="Pregled Instanci"
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleEdit(ride)}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleDelete(ride)}
                              className="text-danger hover:text-danger hover:bg-danger/10"
                              disabled={ride.status === "cancelled"}
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
        )}

        <RideModal
          open={isModalOpen}
          onOpenChange={handleModalClose}
          ride={selectedRide}
        />

        <DeleteRideDialog
          open={isDeleteDialogOpen}
          onOpenChange={setIsDeleteDialogOpen}
          ride={rideToDelete}
        />

        {selectedRide && (
          <RideInstancesView
            open={isInstancesViewOpen}
            onOpenChange={setIsInstancesViewOpen}
            ride={selectedRide}
          />
        )}
      </div>
    </Layout>
  )
}

