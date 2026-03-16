"use client"

import {
  ConfirmDeleteDialog,
} from "@/components/ui/confirm-delete-dialog"
import { useDeletePassengerMutation } from "@/infrastructure/hooks/mutations/usePassengerMutations"

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
  const deletePassengerMutation = useDeletePassengerMutation()

  const handleDelete = async () => {
    if (!passenger) return

    try {
      await deletePassengerMutation.mutateAsync(passenger.id)
      onOpenChange(false)
    } catch (error) {
      // Error is handled in mutation hook
    }
  }

  return (
    <ConfirmDeleteDialog
      open={open}
      onOpenChange={onOpenChange}
      loading={deletePassengerMutation.isPending}
      description={`Da li ste sigurni da želite da obrišete putnika ${passenger?.firstName ?? ""} ${passenger?.lastName ?? ""}? Ova akcija se ne može poništiti.`}
      onConfirm={handleDelete}
    />
  )
}
