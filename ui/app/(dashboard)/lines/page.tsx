"use client"

import { Layout } from "@/components/layout/Layout"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { TooltipProvider } from "@/components/ui/tooltip"
import { Plus, Route } from "lucide-react"
import { LineModal } from "@/components/lines/LineModal"
import { DeleteLineDialog } from "@/components/lines/DeleteLineDialog"
import { LinesDataTable } from "@/components/lines/LinesDataTable"
import { useCrudDialogState } from "@/hooks/useCrudDialogState"
import {
  useCreateLineMutation,
  useDeleteLineMutation,
  useUpdateLineMutation,
} from "@/infrastructure/hooks/mutations/useLineMutations"
import { useLinesListQuery } from "@/infrastructure/hooks/queries/useLinesListQuery"
import type { CreateLineDto, UpdateLineDto } from "@/infrastructure/generated/model"
import type { Line } from "@/types"

export default function LinesPage() {
  const linesQuery = useLinesListQuery()
  const createLineMutation = useCreateLineMutation()
  const updateLineMutation = useUpdateLineMutation()
  const deleteLineMutation = useDeleteLineMutation()
  const lines = linesQuery.data || []
  const loading = linesQuery.isLoading
  const error = linesQuery.error
  const mutationLoading =
    createLineMutation.isPending ||
    updateLineMutation.isPending ||
    deleteLineMutation.isPending
  const {
    isModalOpen,
    isDeleteDialogOpen,
    selectedItem: selectedLine,
    itemToDelete: lineToDelete,
    openCreate,
    openEdit,
    closeModal,
    openDelete,
    setIsDeleteDialogOpen,
  } = useCrudDialogState<Line>()

  const handleCreate = async (payload: CreateLineDto) => {
    await createLineMutation.mutateAsync(payload)
  }

  const handleUpdate = async (id: string, payload: UpdateLineDto) => {
    await updateLineMutation.mutateAsync({ id, payload })
  }

  const handleDelete = async (id: string) => {
    await deleteLineMutation.mutateAsync(id)
  }

  return (
    <TooltipProvider delayDuration={200}>
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
          <Button onClick={openCreate}>
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
        ) : linesQuery.isError ? (
          <div className="flex flex-col items-center justify-center rounded-lg border border-dashed p-12">
            <Route className="mb-3 h-10 w-10 text-muted-foreground" />
            <p className="text-lg font-medium text-muted-foreground">
              Greska pri ucitavanju linija
            </p>
            <p className="mb-4 text-sm text-muted-foreground">
              {error instanceof Error
                ? error.message
                : "Pokrenite ponovno ucitavanje podataka."}
            </p>
            <Button onClick={() => linesQuery.refetch()}>
              Pokusaj ponovo
            </Button>
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
            <Button onClick={openCreate}>
              <Plus className="mr-2 h-4 w-4" />
              Dodaj Liniju
            </Button>
          </div>
        ) : (
          <LinesDataTable lines={lines} onEdit={openEdit} onDelete={openDelete} />
        )}

        <LineModal
          open={isModalOpen}
          onOpenChange={closeModal}
          line={selectedLine}
          loading={mutationLoading}
          onCreate={handleCreate}
          onUpdate={handleUpdate}
        />

        <DeleteLineDialog
          open={isDeleteDialogOpen}
          onOpenChange={setIsDeleteDialogOpen}
          line={lineToDelete}
          loading={mutationLoading}
          onDelete={handleDelete}
        />
      </div>
      </Layout>
    </TooltipProvider>
  )
}

