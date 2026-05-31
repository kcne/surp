import { DialogFooter } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Ban, Check, Save, X } from "lucide-react"

interface ReservationFormActionsProps {
  isEdit: boolean
  showCancelReservation: boolean
  onCancelReservation: () => Promise<void> | void
  onClose: () => void
  loading: boolean
  useSubmitAction: boolean
  isMultipleSeatsSelection: boolean
  onPerSeatSubmit: () => void
  canSubmit: boolean
}

export function ReservationFormActions({
  isEdit,
  showCancelReservation,
  onCancelReservation,
  onClose,
  loading,
  useSubmitAction,
  isMultipleSeatsSelection,
  onPerSeatSubmit,
  canSubmit,
}: ReservationFormActionsProps) {
  const submitDisabled = loading || !canSubmit
  return (
    <DialogFooter className="flex items-center justify-between">
      <div>
        {showCancelReservation && (
          <Button
            type="button"
            variant="destructive"
            onClick={onCancelReservation}
            disabled={loading}
          >
            <Ban className="mr-2 h-4 w-4" />
            Otkaži Rezervaciju
          </Button>
        )}
      </div>
      <div className="flex gap-2">
        <Button type="button" variant="outline" onClick={onClose} disabled={loading}>
          <X className="mr-2 h-4 w-4" />
          Otkaži
        </Button>
        {useSubmitAction ? (
          <Button type="submit" disabled={submitDisabled}>
            {isEdit ? <Save className="mr-2 h-4 w-4" /> : <Check className="mr-2 h-4 w-4" />}
            {loading
              ? isEdit
                ? "Čuvanje..."
                : "Rezervisanje..."
              : isEdit
              ? "Sačuvaj Izmene"
              : isMultipleSeatsSelection
              ? "Kreiraj rezervacije"
              : "Kreiraj rezervaciju"}
          </Button>
        ) : (
          <Button type="button" disabled={submitDisabled} onClick={onPerSeatSubmit}>
            <Check className="mr-2 h-4 w-4" />
            {loading ? "Rezervisanje..." : "Kreiraj Rezervacije"}
          </Button>
        )}
      </div>
    </DialogFooter>
  )
}
