"use client"

import {
  ConfirmDeleteDialog,
} from "@/components/ui/confirm-delete-dialog"

interface DeleteLineDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  line: { id: string; name: string } | null
  loading: boolean
  onDelete: (id: string) => Promise<void>
}

export function DeleteLineDialog({
  open,
  onOpenChange,
  line,
  loading,
  onDelete,
}: DeleteLineDialogProps) {
  const handleDelete = async () => {
    if (!line) return

    try {
      await onDelete(line.id)
      onOpenChange(false)
    } catch (error) {
      // Error is handled in mutation hook
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










