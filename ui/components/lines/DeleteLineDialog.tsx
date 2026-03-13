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
import { useLinesStore } from "@/stores/linesStore"
import { Trash2, X } from "lucide-react"

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
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Da li ste sigurni?</AlertDialogTitle>
          <AlertDialogDescription>
            Da li ste sigurni da želite da obrišete liniju{" "}
            <strong>{line?.name}</strong>? Ova akcija se ne može poništiti.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={loading}>
            <X className="mr-2 h-4 w-4" />
            Otkaži
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={handleDelete}
            disabled={loading}
            className="bg-danger text-white hover:bg-danger/90"
          >
            <Trash2 className="mr-2 h-4 w-4" />
            {loading ? "Brisanje..." : "Obriši"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}










