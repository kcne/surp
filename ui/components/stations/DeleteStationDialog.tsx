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
import { useStationsStore } from "@/stores/stationsStore"
import { toast } from "sonner"
import { Trash2, X } from "lucide-react"

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
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Da li ste sigurni?</AlertDialogTitle>
          <AlertDialogDescription>
            Da li ste sigurni da želite da obrišete stanicu{" "}
            <strong>{station?.name}</strong>? Ova akcija se ne može poništiti.
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










