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
import { useRidesStore } from "@/stores/ridesStore"
import { Ban, X } from "lucide-react"

interface DeleteRideDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  ride: { id: string; name: string } | null
}

export function DeleteRideDialog({
  open,
  onOpenChange,
  ride,
}: DeleteRideDialogProps) {
  const { cancelRide, loading } = useRidesStore()

  const handleCancel = async () => {
    if (!ride) return

    try {
      await cancelRide(ride.id)
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
            Da li ste sigurni da želite da otkažete vožnju{" "}
            <strong>{ride?.name}</strong>? Ova akcija će otkazati vožnju.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={loading}>
            <X className="mr-2 h-4 w-4" />
            Otkaži
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={handleCancel}
            disabled={loading}
            className="bg-danger text-white hover:bg-danger/90"
          >
            <Ban className="mr-2 h-4 w-4" />
            {loading ? "Otkazivanje..." : "Otkaži Vožnju"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}










