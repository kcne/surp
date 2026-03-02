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
import { Eye, Plus, Pencil, Search, Trash2, MapPin, Map, Phone, FileText, Settings2, Tags, ChevronLeft, ChevronRight } from "lucide-react"
import { useStationsStore } from "@/stores/stationsStore"
import { StationModal } from "@/components/stations/StationModal"
import { DeleteStationDialog } from "@/components/stations/DeleteStationDialog"
import type { Station } from "@/types"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"

export default function StationsPage() {
  const { stations, loading, fetchStations } = useStationsStore()
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [isViewMode, setIsViewMode] = useState(false)
  const [selectedStation, setSelectedStation] = useState<Station | null>(null)
  const [stationToDelete, setStationToDelete] = useState<Station | null>(null)
  const [searchValue, setSearchValue] = useState("")
  const [currentPage, setCurrentPage] = useState(1)
  const pageSize = 10

  useEffect(() => {
    fetchStations()
  }, [fetchStations])

  useEffect(() => {
    setCurrentPage(1)
  }, [searchValue])

  const filteredStations = useMemo(() => {
    const term = searchValue.trim().toLowerCase()
    if (!term) return stations

    return stations.filter((station) => {
      return [
        station.name,
        station.address,
        station.category || "",
        station.contactPhone || "",
        station.notes || "",
      ]
        .join(" ")
        .toLowerCase()
        .includes(term)
    })
  }, [searchValue, stations])

  const totalPages = Math.max(1, Math.ceil(filteredStations.length / pageSize))
  const paginatedStations = useMemo(() => {
    const start = (currentPage - 1) * pageSize
    return filteredStations.slice(start, start + pageSize)
  }, [currentPage, filteredStations])

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages)
    }
  }, [currentPage, totalPages])

  const handleEdit = (station: Station) => {
    setIsViewMode(false)
    setSelectedStation(station)
    setIsModalOpen(true)
  }

  const handleView = (station: Station) => {
    setIsViewMode(true)
    setSelectedStation(station)
    setIsModalOpen(true)
  }

  const handleDelete = (station: Station) => {
    setStationToDelete(station)
    setIsDeleteDialogOpen(true)
  }

  const handleAddNew = () => {
    setIsViewMode(false)
    setSelectedStation(null)
    setIsModalOpen(true)
  }

  const handleModalClose = () => {
    setIsModalOpen(false)
    setSelectedStation(null)
    setIsViewMode(false)
  }

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="flex items-center gap-2 text-2xl font-bold">
              <MapPin className="h-6 w-6 text-primary" />
              Stanice
            </h1>
            <p className="text-muted-foreground">
              Upravljajte autobuskim stanicama u sistemu
            </p>
          </div>
          <Button onClick={handleAddNew}>
            <Plus className="mr-2 h-4 w-4" />
            Dodaj Stanicu
          </Button>
        </div>

        {loading && stations.length === 0 ? (
          <div className="space-y-4">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
          </div>
        ) : stations.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-lg border border-dashed p-12">
            <MapPin className="mb-3 h-10 w-10 text-muted-foreground" />
            <p className="text-lg font-medium text-muted-foreground">
              Nema stanica
            </p>
            <p className="mb-4 text-sm text-muted-foreground">
              Dodajte prvu stanicu da biste počeli
            </p>
            <Button onClick={handleAddNew}>
              <Plus className="mr-2 h-4 w-4" />
              Dodaj Stanicu
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
                    placeholder="Pretraži stanice"
                    className="pl-9"
                  />
                </div>
                <div className="rounded-md border bg-background px-3 py-1 text-xs text-muted-foreground">
                  {filteredStations.length} stanica
                </div>
              </div>
            </div>

            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>
                      <span className="inline-flex items-center gap-1">
                        <MapPin className="h-4 w-4 text-muted-foreground" />
                        Naziv Stanice
                      </span>
                    </TableHead>
                    <TableHead>
                      <span className="inline-flex items-center gap-1">
                        <Map className="h-4 w-4 text-muted-foreground" />
                        Adresa
                      </span>
                    </TableHead>
                    <TableHead>
                      <span className="inline-flex items-center gap-1">
                        <Tags className="h-4 w-4 text-muted-foreground" />
                        Kategorija
                      </span>
                    </TableHead>
                    <TableHead>
                      <span className="inline-flex items-center gap-1">
                        <Phone className="h-4 w-4 text-muted-foreground" />
                        Kontakt telefon
                      </span>
                    </TableHead>
                    <TableHead>
                      <span className="inline-flex items-center gap-1">
                        <FileText className="h-4 w-4 text-muted-foreground" />
                        Napomene
                      </span>
                    </TableHead>
                    <TableHead className="text-right">
                      <span className="inline-flex items-center justify-end gap-1">
                        <Settings2 className="h-4 w-4 text-muted-foreground" />
                        Akcije
                      </span>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedStations.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">
                        Nema rezultata za uneti pojam
                      </TableCell>
                    </TableRow>
                  ) : (
                    paginatedStations.map((station) => (
                      <TableRow key={station.id}>
                        <TableCell className="font-semibold text-primary">
                          {station.name}
                        </TableCell>
                        <TableCell>{station.address}</TableCell>
                        <TableCell>
                          {station.category ? (
                            <Badge variant="secondary">{station.category}</Badge>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {station.contactPhone ? (
                            station.contactPhone
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {station.notes ? (
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <span className="cursor-help truncate max-w-[200px] inline-block">
                                    {station.notes.length > 50
                                      ? `${station.notes.substring(0, 50)}...`
                                      : station.notes}
                                  </span>
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p className="max-w-xs">{station.notes}</p>
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleView(station)}
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleEdit(station)}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleDelete(station)}
                              className="text-danger hover:text-danger hover:bg-danger/10"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>

            <div className="flex items-center justify-between rounded-md border bg-background px-4 py-2">
              <p className="text-sm text-muted-foreground">
                Strana {currentPage} od {totalPages}
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                  disabled={currentPage === 1}
                >
                  <ChevronLeft className="mr-1 h-4 w-4" />
                  Prethodna
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
                  disabled={currentPage === totalPages}
                >
                  Sledeća
                  <ChevronRight className="ml-1 h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        )}

        <StationModal
          open={isModalOpen}
          onOpenChange={handleModalClose}
          station={selectedStation}
          readOnly={isViewMode}
        />

        <DeleteStationDialog
          open={isDeleteDialogOpen}
          onOpenChange={setIsDeleteDialogOpen}
          station={stationToDelete}
        />
      </div>
    </Layout>
  )
}










