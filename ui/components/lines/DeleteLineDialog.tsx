"use client"

import {
  ConfirmDeleteDialog,
} from "@/components/ui/confirm-delete-dialog"
import { useLinesStore } from "@/stores/linesStore"

interface DeleteLineDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  line: { id: string; name: string } | null
}

export function DeleteLineDialog({
  open,
  onOpenChange,
  line,
}: DeleteLineDialogProps) {
  const { deleteLine, loading } = useLinesStore()

  const handleDelete = async () => {
    if (!line) return

    try {
      await deleteLine(line.id)
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
      description={`Da li ste sigurni da želite da obrišete liniju ${line?.name ?? ""}? Ova akcija se ne može poništiti.`}
      onConfirm={handleDelete}
    />
  )
}










