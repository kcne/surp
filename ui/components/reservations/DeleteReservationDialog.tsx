"use client"

import {
  ConfirmDeleteDialog,
} from "@/components/ui/confirm-delete-dialog"
import { useReservationsStore } from "@/stores/reservationsStore"
import type { Reservation } from "@/types"
import { formatPassengerName } from "@/utils/formatters"
import { Ban } from "lucide-react"

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

  const passengerName = formatPassengerName(
    reservation.passenger.firstName,
    reservation.passenger.lastName
  )

  return (
    <ConfirmDeleteDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Otkaži Rezervaciju?"
      cancelLabel="Ne"
      confirmLabel="Otkaži Rezervaciju"
      loadingLabel="Otkazivanje..."
      confirmIcon={Ban}
      loading={loading}
      description={`Da li ste sigurni da želite da otkažete rezervaciju za ${passengerName} na sedištu ${reservation.seatNumber}? Ova akcija se ne može poništiti.`}
      onConfirm={handleCancel}
    />
  )
}










