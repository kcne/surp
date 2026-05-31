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
import { AlertTriangle } from "lucide-react"
import type { PassengerResponseDto } from "@/infrastructure/generated/model/passengerResponseDto"

interface DuplicatePassengerDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  matches: PassengerResponseDto[]
  loading?: boolean
  onConfirm: () => void
  onCancel: () => void
}

export function DuplicatePassengerDialog({
  open,
  onOpenChange,
  matches,
  loading = false,
  onConfirm,
  onCancel,
}: DuplicatePassengerDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            Putnik već postoji
          </AlertDialogTitle>
          <AlertDialogDescription>
            Pronašli smo {matches.length === 1 ? "putnika" : "putnike"} sa istim imenom i prezimenom ili brojem telefona. Da li želite da nastavite sa kreiranjem novog putnika?
          </AlertDialogDescription>
        </AlertDialogHeader>
        <ul className="max-h-48 overflow-y-auto rounded-md border bg-muted/40 p-2 text-sm">
          {matches.map((match) => (
            <li
              key={match.id}
              className="flex items-center justify-between gap-3 px-2 py-1.5"
            >
              <span className="font-medium">
                {match.firstName} {match.lastName}
              </span>
              <span className="font-mono text-xs text-muted-foreground">
                {match.phone}
              </span>
            </li>
          ))}
        </ul>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={loading} onClick={onCancel}>
            Otkaži
          </AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm} disabled={loading}>
            {loading ? "Kreiranje..." : "Nastavi"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
