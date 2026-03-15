import { Button } from "@/components/ui/button"
import { PassengerSearch } from "@/components/reservations/PassengerSearch"
import type { Passenger } from "@/types"
import { UserPlus } from "lucide-react"

interface ReservationPerSeatPassengersSectionProps {
  selectedSeats: number[]
  perSeatPassengers: Record<number, Passenger | null>
  onSelectPassenger: (seat: number, passenger: Passenger | null) => void
  onAddNewPassenger: () => void
}

export function ReservationPerSeatPassengersSection({
  selectedSeats,
  perSeatPassengers,
  onSelectPassenger,
  onAddNewPassenger,
}: ReservationPerSeatPassengersSectionProps) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium">Putnici po sedištu *</p>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onAddNewPassenger}
          className="text-primary"
        >
          <UserPlus className="mr-2 h-4 w-4" />
          Dodaj Novog Putnika
        </Button>
      </div>
      <div className="grid gap-3">
        {selectedSeats
          .slice()
          .sort((a, b) => a - b)
          .map((seat) => (
            <div key={seat} className="rounded-lg border bg-gray-50 p-3">
              <div className="mb-2 flex items-center justify-between">
                <span className="font-semibold">Sedište {seat}</span>
              </div>
              <PassengerSearch
                value={perSeatPassengers[seat] || null}
                onSelect={(passenger) => onSelectPassenger(seat, passenger)}
                onAddNew={onAddNewPassenger}
              />
            </div>
          ))}
      </div>
    </div>
  )
}
