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
import type { WouldBreakReservationsDto } from "@/infrastructure/generated/model"
import { AlertTriangle, Wrench, X } from "lucide-react"

interface ConfirmBreakingChangeDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  confirmation: WouldBreakReservationsDto | null
  /** An earlier part of the same edit was already saved before the refusal. */
  partiallyApplied?: boolean
  /**
   * The agency already answered this question, and the server asked again
   * because the affected reservations changed in the meantime.
   */
  changedSinceAnswered?: boolean
  /**
   * The agency asked for a repair of exactly this set, and the repair could not
   * settle all of it, so nothing was saved.
   */
  repairFailed?: boolean
  loading?: boolean
  onConfirm: () => Promise<void> | void
  /**
   * Save and put the affected reservations back in order. Offered only when
   * the server said every one of them can be settled — most breakages are a
   * routing decision or a telephone call, and for those this never appears.
   */
  onRepair?: () => Promise<void> | void
}

export function ConfirmBreakingChangeDialog({
  open,
  onOpenChange,
  confirmation,
  partiallyApplied = false,
  changedSinceAnswered = false,
  repairFailed = false,
  loading = false,
  onConfirm,
  onRepair,
}: ConfirmBreakingChangeDialogProps) {
  const canRepair = confirmation?.repairable === true && onRepair !== undefined

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Ova izmena pogadja postojece podatke</AlertDialogTitle>
          <AlertDialogDescription>
            {changedSinceAnswered && (
              <span className="mb-2 block font-medium text-foreground" role="status">
                U medjuvremenu su se rezervacije promenile. Proverite novo stanje pre nego sto
                ponovo odgovorite.
              </span>
            )}
            {repairFailed && (
              <span className="mb-2 block font-medium text-foreground" role="status">
                Popravka nije mogla da resi sve pogodjene rezervacije, pa nista nije sacuvano.
                Mozete ipak sacuvati bez popravke ili odustati.
              </span>
            )}
            {/* The server's sentence already carries the count, in Serbian that
                agrees with it — repeating it here only risks disagreeing. */}
            <span className="block font-medium text-foreground">{confirmation?.message}</span>
            {canRepair && confirmation?.repairMessage && (
              <span className="mt-2 block">
                Mozete sacuvati i odmah popraviti: {confirmation.repairMessage} Obavestite putnike
                o novom vremenu i sedistu.
              </span>
            )}
            <span className="mt-2 block">
              {canRepair
                ? "Ako sacuvate bez popravke, problem ostaje vidljiv u proveri podataka dok ga ne resite."
                : "Ako ipak nastavite, problem ostaje vidljiv u proveri podataka dok ga ne resite."}
            </span>
            {partiallyApplied && (
              <span className="mt-2 block">
                Deo izmene je vec sacuvan. Ako odustanete, taj deo ostaje sacuvan.
              </span>
            )}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="flex-col gap-2 sm:flex-row sm:space-x-0">
          <AlertDialogCancel disabled={loading} className="mt-0">
            <X className="mr-2 h-4 w-4" />
            Odustani
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={(event) => {
              event.preventDefault()
              void onConfirm()
            }}
            disabled={loading}
            className="bg-danger text-white hover:bg-danger/90"
          >
            <AlertTriangle className="mr-2 h-4 w-4" />
            {loading ? "Cuvanje..." : "Ipak sacuvaj"}
          </AlertDialogAction>
          {canRepair && (
            <AlertDialogAction
              onClick={(event) => {
                event.preventDefault()
                void onRepair()
              }}
              disabled={loading}
            >
              <Wrench className="mr-2 h-4 w-4" />
              {loading ? "Cuvanje..." : "Sacuvaj i popravi"}
            </AlertDialogAction>
          )}
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
