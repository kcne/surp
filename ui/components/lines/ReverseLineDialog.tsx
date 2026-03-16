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
import { Repeat, X } from "lucide-react"

interface ReverseLineDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  line: {
    id: string
    name: string
    departureStation: { name: string }
    arrivalStation: { name: string }
    intermediateStations: Array<{ stationName: string }>
  } | null
  loading: boolean
  onReverse: (id: string) => Promise<void>
}

export function ReverseLineDialog({
  open,
  onOpenChange,
  line,
  loading,
  onReverse,
}: ReverseLineDialogProps) {
  const handleReverse = async () => {
    if (!line) return

    try {
      await onReverse(line.id)
      onOpenChange(false)
    } catch (error) {
      // Error is handled in mutation hook
    }
  }

  if (!line) return null

  const reversedStations = [
    line.arrivalStation,
    ...line.intermediateStations.map((s) => ({ name: s.stationName })),
    line.departureStation,
  ].reverse()

  const reversedRoute = reversedStations.map((s) => s.name).join(" → ")

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Kreiraj Obrnutu Liniju</AlertDialogTitle>
          <AlertDialogDescription className="space-y-2">
            <p>
              Kreiraće se nova linija sa obrnutim redosledom stanica:
            </p>
            <div className="rounded-lg border bg-gray-50 p-3">
              <p className="font-semibold text-sm mb-1">Naziv:</p>
              <p className="text-sm">
                {line.arrivalStation.name} - {line.departureStation.name}
              </p>
              <p className="font-semibold text-sm mb-1 mt-3">Ruta:</p>
              <p className="text-sm">{reversedRoute}</p>
            </div>
            <p className="text-sm text-muted-foreground mt-2">
              Da li želite da nastavite?
            </p>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={loading}>
            <X className="mr-2 h-4 w-4" />
            Otkaži
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={handleReverse}
            disabled={loading}
            className="bg-primary text-white hover:bg-primary/90"
          >
            <Repeat className="mr-2 h-4 w-4" />
            {loading ? "Kreiranje..." : "Kreiraj Obrnutu Liniju"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}










