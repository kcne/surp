import { PassengerSearch } from "@/components/reservations/PassengerSearch"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { UserPlus } from "lucide-react"
import type { Passenger } from "@/types"

interface ReservationPerSeatPassengersSectionProps {
  selectedSeats: number[]
  perSeatPassengers: Record<number, Passenger | null>
  perSeatNotes: Record<number, string>
  onSelectPassenger: (seat: number, passenger: Passenger | null) => void
  onChangeNotes: (seat: number, notes: string) => void
  onAddNewPassengerForSeat: (seat: number) => void
}

export function ReservationPerSeatPassengersSection({
  selectedSeats,
  perSeatPassengers,
  perSeatNotes,
  onSelectPassenger,
  onChangeNotes,
  onAddNewPassengerForSeat,
}: ReservationPerSeatPassengersSectionProps) {
  return (
    <div className="space-y-3">
      <div className="grid gap-3">
        {selectedSeats
          .slice()
          .sort((a, b) => a - b)
          .map((seat) => (
            <div key={seat} className="space-y-2 rounded-lg border bg-gray-50 p-3">
              <div className="flex items-center justify-between gap-2">
                <span className="font-semibold">Sedište {seat}</span>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => onAddNewPassengerForSeat(seat)}
                >
                  <UserPlus className="mr-1.5 h-3.5 w-3.5" />
                  Novi putnik
                </Button>
              </div>
              <PassengerSearch
                value={perSeatPassengers[seat] || null}
                onSelect={(passenger) => onSelectPassenger(seat, passenger)}
                onAddNew={() => onAddNewPassengerForSeat(seat)}
              />
              <div className="space-y-1">
                <Label
                  htmlFor={`per-seat-notes-${seat}`}
                  className="text-xs font-medium text-muted-foreground"
                >
                  Napomena (opciono)
                </Label>
                <Textarea
                  id={`per-seat-notes-${seat}`}
                  value={perSeatNotes[seat] ?? ""}
                  onChange={(event) => onChangeNotes(seat, event.target.value)}
                  placeholder="npr. Putnik silazi na drugoj stanici"
                  rows={2}
                  maxLength={500}
                  className="text-sm"
                />
              </div>
            </div>
          ))}
      </div>
    </div>
  )
}
