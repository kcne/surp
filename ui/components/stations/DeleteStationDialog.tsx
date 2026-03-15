"use client"

import {
  ConfirmDeleteDialog,
} from "@/components/ui/confirm-delete-dialog"
import { useStationsStore } from "@/stores/stationsStore"

interface DeleteStationDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  station: { id: string; name: string } | null
}

export function DeleteStationDialog({
  open,
  onOpenChange,
  station,
}: DeleteStationDialogProps) {
  const { deleteStation, loading } = useStationsStore()

  const handleDelete = async () => {
    if (!station) return

    try {
      await deleteStation(station.id)
      onOpenChange(false)
    } catch (error) {
      // Error is handled in store
    }
  }

  return (
    <ConfirmDeleteDialog
      open={open}
      onOpenChange={onOpenChange}
      loading={loading}
      description={`Da li ste sigurni da želite da obrišete stanicu ${station?.name ?? ""}? Ova akcija se ne može poništiti.`}
      onConfirm={handleDelete}
    />
  )
}










