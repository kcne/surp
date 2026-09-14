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
import { AlertTriangle, X } from "lucide-react"

/**
 * Asks the question the server refused to answer on its own.
 *
 * Lowering a ride's capacity under a seat that is already sold is sometimes
 * exactly right — a smaller bus was substituted — and sometimes a typo that
 * quietly invalidates every seat above the new number. Only the agency knows
 * which, so the change is held until somebody says so, with the count of
 * affected passengers in front of them.
 */
interface ConfirmBreakingRideChangeDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  confirmation: WouldBreakReservationsDto | null
  loading?: boolean
  onConfirm: () => Promise<void> | void
}

export function ConfirmBreakingRideChangeDialog({
  open,
  onOpenChange,
  confirmation,
  loading = false,
  onConfirm,
}: ConfirmBreakingRideChangeDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Ova izmena pogadja postojece rezervacije</AlertDialogTitle>
          <AlertDialogDescription>
            {confirmation?.message}
            {" "}
            Ako ipak nastavite, te rezervacije ostaju upisane i prikazuju se u proveri podataka
            dok ih ne resite.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={loading}>
            <X className="mr-2 h-4 w-4" />
            Odustani
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={(event) => {
              // Radix closes the dialog on its own the moment Action is
              // clicked. Left alone that unmounts the question before the
              // answer has been written: no "Cuvanje...", no disabled button,
              // and a save that then fails leaves nothing on screen to retry.
              // The page closes it once the write is actually through.
              event.preventDefault()
              void onConfirm()
            }}
            disabled={loading}
            className="bg-danger text-white hover:bg-danger/90"
          >
            <AlertTriangle className="mr-2 h-4 w-4" />
            {loading ? "Cuvanje..." : "Ipak sacuvaj"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
