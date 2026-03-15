"use client"

import {
  ConfirmDeleteDialog,
} from "@/components/ui/confirm-delete-dialog"
import { usePassengersStore } from "@/stores/passengersStore"

interface DeletePassengerDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  passenger: { id: string; firstName: string; lastName: string } | null
}

export function DeletePassengerDialog({
  open,
  onOpenChange,
  passenger,
}: DeletePassengerDialogProps) {
  const { deletePassenger, loading } = usePassengersStore()

  const handleDelete = async () => {
    if (!passenger) return

    try {
      await deletePassenger(passenger.id)
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
      description={`Da li ste sigurni da želite da obrišete putnika ${passenger?.firstName ?? ""} ${passenger?.lastName ?? ""}? Ova akcija se ne može poništiti.`}
      onConfirm={handleDelete}
    />
  )
}
