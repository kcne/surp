"use client"

import { useEffect, useState, type FormEvent } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

export interface ExtraDepartureValues {
  serviceDate: string
  departureTime: string
  arrivalTime: string
  capacity: number
}

interface ExtraDepartureDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** "create" asks for the date too; an extra keeps its date once added. */
  mode: "create" | "edit"
  initialValues: ExtraDepartureValues
  /** The dates an extra can be added for: the agency's today to +365 days. */
  minDate: string
  maxDate: string
  loading: boolean
  /** Rejects to keep the dialog open on what was typed. */
  onSubmit: (values: ExtraDepartureValues) => Promise<void>
}

const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/

/** The first problem with the values, in Serbian, or null when they can be sent. */
export function validateExtraDeparture(
  values: ExtraDepartureValues,
  { minDate, maxDate, checkDate }: { minDate: string; maxDate: string; checkDate: boolean }
): string | null {
  if (checkDate && (!values.serviceDate || values.serviceDate < minDate || values.serviceDate > maxDate)) {
    return `Datum mora biti od ${minDate} do ${maxDate}.`
  }

  if (!TIME_PATTERN.test(values.departureTime) || !TIME_PATTERN.test(values.arrivalTime)) {
    return "Unesite vreme polaska i vreme dolaska u formatu SS:MM."
  }

  if (values.departureTime === values.arrivalTime) {
    return "Vreme polaska i vreme dolaska ne mogu biti isti."
  }

  if (!Number.isInteger(values.capacity) || values.capacity < 1 || values.capacity > 100) {
    return "Kapacitet mora biti ceo broj od 1 do 100."
  }

  return null
}

export function ExtraDepartureDialog({
  open,
  onOpenChange,
  mode,
  initialValues,
  minDate,
  maxDate,
  loading,
  onSubmit,
}: ExtraDepartureDialogProps) {
  const [values, setValues] = useState(initialValues)
  const [problem, setProblem] = useState<string | null>(null)

  useEffect(() => {
    if (open) {
      setValues(initialValues)
      setProblem(null)
    }
    // Reset only when the dialog opens, not on every parent render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const set = <K extends keyof ExtraDepartureValues>(key: K, value: ExtraDepartureValues[K]) =>
    setValues((current) => ({ ...current, [key]: value }))

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    const invalid = validateExtraDeparture(values, { minDate, maxDate, checkDate: mode === "create" })

    if (invalid) {
      setProblem(invalid)
      return
    }

    setProblem(null)

    try {
      await onSubmit(values)
    } catch {
      // Refusals are answered by the page: a toast, or a confirmation dialog.
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[440px]">
        <DialogHeader>
          <DialogTitle>{mode === "create" ? "Dodaj dodatni polazak" : "Izmeni dodatni polazak"}</DialogTitle>
          <DialogDescription>
            {mode === "create"
              ? "Dodatni autobus ove voznje za jedan dan. Ide istom linijom i stajalistima."
              : `Dodatni polazak ${values.serviceDate}. Putnici prate novo vreme.`}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={submit} className="space-y-4" noValidate>
          {mode === "create" && (
            <div className="space-y-1">
              <Label htmlFor="extra-departure-date">Datum</Label>
              <Input
                id="extra-departure-date"
                type="date"
                min={minDate}
                max={maxDate}
                value={values.serviceDate}
                onChange={(event) => set("serviceDate", event.target.value)}
                required
              />
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="extra-departure-time">Vreme polaska</Label>
              <Input
                id="extra-departure-time"
                type="time"
                value={values.departureTime}
                onChange={(event) => set("departureTime", event.target.value)}
                required
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="extra-arrival-time">Vreme dolaska</Label>
              <Input
                id="extra-arrival-time"
                type="time"
                value={values.arrivalTime}
                onChange={(event) => set("arrivalTime", event.target.value)}
                required
              />
            </div>
          </div>

          <div className="space-y-1">
            <Label htmlFor="extra-capacity">Kapacitet</Label>
            <Input
              id="extra-capacity"
              type="number"
              min={1}
              max={100}
              value={Number.isNaN(values.capacity) ? "" : values.capacity}
              onChange={(event) => set("capacity", event.target.valueAsNumber)}
              required
            />
          </div>

          {problem && (
            <p role="alert" className="text-sm text-destructive">
              {problem}
            </p>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
              Odustani
            </Button>
            <Button type="submit" disabled={loading}>
              {mode === "create" ? "Dodaj" : "Sacuvaj"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
