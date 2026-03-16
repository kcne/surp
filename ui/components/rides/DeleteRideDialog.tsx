"use client"

import {
  ConfirmDeleteDialog,
} from "@/components/ui/confirm-delete-dialog"
import { Ban } from "lucide-react"

interface DeleteRideDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  ride: { id: string; name: string } | null
  loading: boolean
  onDelete: (id: string) => Promise<void>
}

export function DeleteRideDialog({
  open,
  onOpenChange,
  ride,
  loading,
  onDelete,
}: DeleteRideDialogProps) {
  const handleCancel = async () => {
    if (!ride) return

    try {
      await onDelete(ride.id)
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
      confirmLabel="Otkaži Vožnju"
      loadingLabel="Otkazivanje..."
      confirmIcon={Ban}
      description={`Da li ste sigurni da želite da otkažete vožnju ${ride?.name ?? ""}? Ova akcija će otkazati vožnju.`}
      onConfirm={handleCancel}
    />
  )
}










