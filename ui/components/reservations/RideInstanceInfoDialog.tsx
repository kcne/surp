import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { LineRoute } from "@/components/lines/LineRoute"
import { formatDateDisplay, formatTimeDisplay } from "@/utils/dateHelpers"
import type { Reservation, RideInstance, RideStatus } from "@/types"

interface RideInstanceInfoDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  selectedInstance: RideInstance | null
  selectedInstanceReservations: Reservation[]
  statusLabels: Record<RideStatus, string>
}

export function RideInstanceInfoDialog({
  open,
  onOpenChange,
  selectedInstance,
  selectedInstanceReservations,
  statusLabels,
}: RideInstanceInfoDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[85vh] flex-col sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Više informacija</DialogTitle>
          <DialogDescription>{selectedInstance?.ride.line.name}</DialogDescription>
        </DialogHeader>
        {selectedInstance && (
          <div className="-mr-2 flex-1 space-y-4 overflow-y-auto pr-2">
            <div className="grid gap-3 rounded-lg border bg-muted/30 p-4 sm:grid-cols-2">
              <p className="text-sm">
                Datum: <span className="font-medium">{formatDateDisplay(selectedInstance.date)}</span>
              </p>
              <p className="text-sm">
                Vreme: <span className="font-medium">{formatTimeDisplay(selectedInstance.departureTime)}</span>
              </p>
              <p className="text-sm">
                Status: <span className="font-medium">{statusLabels[selectedInstance.status]}</span>
              </p>
              <p className="text-sm">
                Putnika: <span className="font-medium">{selectedInstanceReservations.length}</span>
              </p>
            </div>

            <div className="rounded-lg border bg-muted/30 p-4">
              <p className="mb-3 text-sm font-semibold">Ruta</p>
              <LineRoute line={selectedInstance.ride.line} />
            </div>

            <div className="rounded-lg border p-4">
              <p className="mb-3 text-sm font-semibold">Lista putnika</p>
              {selectedInstanceReservations.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nema rezervisanih putnika za ovu vožnju.</p>
              ) : (
                <div className="space-y-2">
                  {selectedInstanceReservations.map((reservation) => (
                    <div
                      key={reservation.id}
                      className="flex items-center justify-between rounded-md border bg-muted/20 px-3 py-2 text-sm"
                    >
                      <span className="font-medium">
                        {reservation.passenger.firstName} {reservation.passenger.lastName}
                      </span>
                      <span className="text-muted-foreground">
                        Sedište {reservation.seatNumber} • {reservation.departureStation.name} → {reservation.arrivalStation.name}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
