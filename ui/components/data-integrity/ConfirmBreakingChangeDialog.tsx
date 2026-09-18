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
  loading?: boolean
  onConfirm: () => Promise<void> | void
}

export function ConfirmBreakingChangeDialog({
  open,
  onOpenChange,
  confirmation,
  loading = false,
  onConfirm,
}: ConfirmBreakingChangeDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Ova izmena pogadja postojece podatke</AlertDialogTitle>
          <AlertDialogDescription>
            <span className="block font-medium text-foreground">
              {confirmation?.affectedCount ?? 0} pogodjenih stavki
            </span>
            <span className="mt-2 block">
              {confirmation?.message} Ako ipak nastavite, problem ostaje vidljiv u proveri podataka
              dok ga ne resite.
            </span>
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
