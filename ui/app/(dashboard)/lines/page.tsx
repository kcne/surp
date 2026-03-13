"use client"

import { useEffect, useState } from "react"
import { Layout } from "@/components/layout/Layout"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Plus, Route } from "lucide-react"
import { useLinesStore } from "@/stores/linesStore"
import { useStationsStore } from "@/stores/stationsStore"
import { LineModal } from "@/components/lines/LineModal"
import { DeleteLineDialog } from "@/components/lines/DeleteLineDialog"
import { LinesDataTable } from "@/components/lines/LinesDataTable"
import type { Line } from "@/types"

export default function LinesPage() {
  const { lines, loading, fetchLines } = useLinesStore()
  const { fetchStations } = useStationsStore()
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [selectedLine, setSelectedLine] = useState<Line | null>(null)
  const [lineToDelete, setLineToDelete] = useState<Line | null>(null)

  useEffect(() => {
    fetchStations().then(() => {
      fetchLines()
    })
  }, [fetchStations, fetchLines])

  const handleEdit = (line: Line) => {
    setSelectedLine(line)
    setIsModalOpen(true)
  }

  const handleDelete = (line: Line) => {
    setLineToDelete(line)
    setIsDeleteDialogOpen(true)
  }

  const handleAddNew = () => {
    setSelectedLine(null)
    setIsModalOpen(true)
  }

  const handleModalClose = () => {
    setIsModalOpen(false)
    setSelectedLine(null)
  }

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="flex items-center gap-2 text-2xl font-bold">
              <Route className="h-6 w-6 text-primary" />
              Linije
            </h1>
            <p className="text-muted-foreground">
              Upravljajte autobuskim linijama u sistemu
            </p>
          </div>
          <Button onClick={handleAddNew}>
            <Plus className="mr-2 h-4 w-4" />
            Dodaj Liniju
          </Button>
        </div>

        {loading && lines.length === 0 ? (
          <div className="space-y-4">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
          </div>
        ) : lines.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-lg border border-dashed p-12">
            <Route className="mb-3 h-10 w-10 text-muted-foreground" />
            <p className="text-lg font-medium text-muted-foreground">
              Nema linija
            </p>
            <p className="mb-4 text-sm text-muted-foreground">
              Dodajte prvu liniju da biste počeli
            </p>
            <Button onClick={handleAddNew}>
              <Plus className="mr-2 h-4 w-4" />
              Dodaj Liniju
            </Button>
          </div>
        ) : (
          <LinesDataTable lines={lines} onEdit={handleEdit} onDelete={handleDelete} />
        )}

        <LineModal
          open={isModalOpen}
          onOpenChange={handleModalClose}
          line={selectedLine}
        />

        <DeleteLineDialog
          open={isDeleteDialogOpen}
          onOpenChange={setIsDeleteDialogOpen}
          line={lineToDelete}
        />
      </div>
    </Layout>
  )
}

