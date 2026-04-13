"use client"

import {
  ConfirmDeleteDialog,
} from "@/components/ui/confirm-delete-dialog"
import { useCancelReservationMutation } from "@/infrastructure/hooks/mutations/useReservationMutations"
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
  const cancelReservationMutation = useCancelReservationMutation()

  const handleCancel = async () => {
    if (!reservation) return

    try {
      await cancelReservationMutation.mutateAsync({
        id: reservation.id,
        rideInstanceId: reservation.rideInstanceId,
      })
      onOpenChange(false)
    } catch (error) {
      // Error is handled in mutation hook
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
      loading={cancelReservationMutation.isPending}
      description={`Da li ste sigurni da želite da otkažete rezervaciju za ${passengerName} na sedištu ${reservation.seatNumber}? Ova akcija se ne može poništiti.`}
      onConfirm={handleCancel}
    />
  )
}










