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
import { useReservationsStore } from "@/stores/reservationsStore"
import type { Reservation } from "@/types"
import { formatPassengerName } from "@/utils/formatters"
import { Ban, X } from "lucide-react"

interface DeleteReservationDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  reservation: Reservation | null
}

export function DeleteReservationDialog({
  open,
  onOpenChange,
  reservation,
}: DeleteReservationDialogProps) {
  const { cancelReservation, loading } = useReservationsStore()

  const handleCancel = async () => {
    if (!reservation) return

    try {
      await cancelReservation(reservation.id)
      onOpenChange(false)
    } catch (error) {
      // Error is handled in store
    }
  }

  if (!reservation) return null

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Otkaži Rezervaciju?</AlertDialogTitle>
          <AlertDialogDescription>
            Da li ste sigurni da želite da otkažete rezervaciju za{" "}
            <strong>
              {formatPassengerName(
                reservation.passenger.firstName,
                reservation.passenger.lastName
              )}
            </strong>{" "}
            na sedištu <strong>{reservation.seatNumber}</strong>? Ova akcija se ne može
            poništiti.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={loading}>
            <X className="mr-2 h-4 w-4" />
            Ne
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={handleCancel}
            disabled={loading}
            className="bg-danger text-white hover:bg-danger/90"
          >
            <Ban className="mr-2 h-4 w-4" />
            {loading ? "Otkazivanje..." : "Otkaži Rezervaciju"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}










