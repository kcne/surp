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

interface ConfirmBreakingChangeDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  confirmation: WouldBreakReservationsDto | null
  /** An earlier part of the same edit was already saved before the refusal. */
  partiallyApplied?: boolean
  loading?: boolean
  onConfirm: () => Promise<void> | void
}

export function ConfirmBreakingChangeDialog({
  open,
  onOpenChange,
  confirmation,
  partiallyApplied = false,
  loading = false,
  onConfirm,
}: ConfirmBreakingChangeDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Ova izmena pogadja postojece podatke</AlertDialogTitle>
          <AlertDialogDescription>
            {/* The server's sentence already carries the count, in Serbian that
                agrees with it — repeating it here only risks disagreeing. */}
            <span className="block font-medium text-foreground">{confirmation?.message}</span>
            <span className="mt-2 block">
              Ako ipak nastavite, problem ostaje vidljiv u proveri podataka dok ga ne resite.
            </span>
            {partiallyApplied && (
              <span className="mt-2 block">
                Deo izmene je vec sacuvan. Ako odustanete, taj deo ostaje sacuvan.
              </span>
            )}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={loading}>
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
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
