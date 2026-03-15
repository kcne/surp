"use client"

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import type { LucideIcon } from "lucide-react"
import { Trash2, X } from "lucide-react"

interface ConfirmDeleteDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title?: string
  description: string
  confirmLabel?: string
  cancelLabel?: string
  loadingLabel?: string
  confirmIcon?: LucideIcon
  loading?: boolean
  onConfirm: () => Promise<void> | void
}

export function ConfirmDeleteDialog({
  open,
  onOpenChange,
  title = "Da li ste sigurni?",
  description,
  confirmLabel = "Obriši",
  cancelLabel = "Otkaži",
  loadingLabel = "Brisanje...",
  confirmIcon: ConfirmIcon = Trash2,
  loading = false,
  onConfirm,
}: ConfirmDeleteDialogProps) {
  const handleConfirm = async () => {
    await onConfirm()
  }

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={loading}>
            <X className="mr-2 h-4 w-4" />
            {cancelLabel}
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={handleConfirm}
            disabled={loading}
            className="bg-danger text-white hover:bg-danger/90"
          >
            <ConfirmIcon className="mr-2 h-4 w-4" />
            {loading ? loadingLabel : confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}