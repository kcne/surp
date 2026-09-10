"use client"

import { useEffect, useState } from "react"
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
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Label } from "@/components/ui/label"
import { formatDateDisplay } from "@/utils/dateHelpers"
import { formatPassengerName } from "@/utils/formatters"
import type { Reservation } from "@/types"
import { Ban, X } from "lucide-react"

export type CancelReservationScope = "single" | "group"
type CancelDirections = "both" | "outboundOnly"

interface CancelReservationDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  scope: CancelReservationScope
  /** Reservations on the ride instance being edited: one, or the whole group. */
  outboundReservations: Reservation[]
  /** Matching return legs, if the passengers also travel back. */
  returnReservations: Reservation[]
  loading?: boolean
  onConfirm: (reservations: Reservation[]) => Promise<void> | void
}

function describeReservation(reservation: Reservation): string {
  const passengerName = formatPassengerName(
    reservation.passenger.firstName,
    reservation.passenger.lastName
  )

  return `${passengerName} - sedište ${reservation.seatNumber}`
}

function describeRide(reservation: Reservation): string {
  const instance = reservation.rideInstance

  if (!instance) {
    return ""
  }

  return `${formatDateDisplay(instance.date)} u ${instance.departureTime}`
}

export function CancelReservationDialog({
  open,
  onOpenChange,
  scope,
  outboundReservations,
  returnReservations,
  loading = false,
  onConfirm,
}: CancelReservationDialogProps) {
  const [directions, setDirections] = useState<CancelDirections>("both")
  const hasReturnLeg = returnReservations.length > 0

  useEffect(() => {
    if (open) {
      setDirections("both")
    }
  }, [open])

  if (outboundReservations.length === 0) {
    return null
  }

  const isGroup = scope === "group"
  const reservationsToCancel =
    hasReturnLeg && directions === "both"
      ? [...outboundReservations, ...returnReservations]
      : outboundReservations

  const handleConfirm = async () => {
    await onConfirm(reservationsToCancel)
  }

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            {isGroup ? "Otkaži grupnu rezervaciju?" : "Otkaži rezervaciju?"}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {isGroup
              ? `Otkazujete ${outboundReservations.length} rezervacija sa ove vožnje. Ova akcija se ne može poništiti.`
              : "Ova akcija se ne može poništiti."}
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="space-y-4">
          <div className="rounded-lg border bg-muted/40 p-3">
            <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Polazak {describeRide(outboundReservations[0])}
            </p>
            <ul className="space-y-0.5 text-sm">
              {outboundReservations.map((reservation) => (
                <li key={reservation.id}>{describeReservation(reservation)}</li>
              ))}
            </ul>
          </div>

          {hasReturnLeg && (
            <div className="space-y-2">
              <p className="text-sm font-medium">
                Ova rezervacija ima i povratnu vožnju ({describeRide(returnReservations[0])}).
                Šta želite da otkažete?
              </p>
              <RadioGroup
                value={directions}
                onValueChange={(value) => setDirections(value as CancelDirections)}
              >
                <div className="flex items-start gap-2 rounded-lg border p-3">
                  <RadioGroupItem value="both" id="cancel-directions-both" className="mt-0.5" />
                  <Label htmlFor="cancel-directions-both" className="font-normal">
                    <span className="font-medium">Oba smera</span>
                    <span className="block text-xs text-muted-foreground">
                      Otkazuje i polazak i povratak ({returnReservations.length}{" "}
                      {returnReservations.length === 1 ? "povratna" : "povratnih"}).
                    </span>
                  </Label>
                </div>
                <div className="flex items-start gap-2 rounded-lg border p-3">
                  <RadioGroupItem
                    value="outboundOnly"
                    id="cancel-directions-outbound"
                    className="mt-0.5"
                  />
                  <Label htmlFor="cancel-directions-outbound" className="font-normal">
                    <span className="font-medium">Samo ovaj smer</span>
                    <span className="block text-xs text-muted-foreground">
                      Povratna vožnja ostaje rezervisana.
                    </span>
                  </Label>
                </div>
              </RadioGroup>
            </div>
          )}
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel disabled={loading}>
            <X className="mr-2 h-4 w-4" />
            Ne
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={(event) => {
              event.preventDefault()
              void handleConfirm()
            }}
            disabled={loading}
            className="bg-danger text-white hover:bg-danger/90"
          >
            <Ban className="mr-2 h-4 w-4" />
            {loading
              ? "Otkazivanje..."
              : `Otkaži ${reservationsToCancel.length > 1 ? `(${reservationsToCancel.length})` : ""}`.trim()}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
