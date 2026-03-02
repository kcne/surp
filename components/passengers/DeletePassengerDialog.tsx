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
import { usePassengersStore } from "@/stores/passengersStore"
import { Trash2, X } from "lucide-react"

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
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Da li ste sigurni?</AlertDialogTitle>
          <AlertDialogDescription>
            Da li ste sigurni da želite da obrišete putnika{" "}
            <strong>
              {passenger?.firstName} {passenger?.lastName}
            </strong>
            ? Ova akcija se ne može poništiti.
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
