"use client"

import {
  ConfirmDeleteDialog,
} from "@/components/ui/confirm-delete-dialog"

interface DeleteStationDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  station: { id: string; name: string } | null
  loading: boolean
  onDelete: (id: string) => Promise<void>
}

export function DeleteStationDialog({
  open,
  onOpenChange,
  station,
  loading,
  onDelete,
}: DeleteStationDialogProps) {
  const handleDelete = async () => {
    if (!station) return

    try {
      await onDelete(station.id)
      onOpenChange(false)
    } catch (error) {
      // Error toast is handled in mutation hook.
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










