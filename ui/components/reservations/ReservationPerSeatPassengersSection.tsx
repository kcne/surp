import { PassengerSearch } from "@/components/reservations/PassengerSearch"
import type { Passenger } from "@/types"

interface ReservationPerSeatPassengersSectionProps {
  selectedSeats: number[]
  perSeatPassengers: Record<number, Passenger | null>
  onSelectPassenger: (seat: number, passenger: Passenger | null) => void
  onAddNewPassengerForSeat: (seat: number) => void
}

export function ReservationPerSeatPassengersSection({
  selectedSeats,
  perSeatPassengers,
  onSelectPassenger,
  onAddNewPassengerForSeat,
}: ReservationPerSeatPassengersSectionProps) {
  return (
    <div className="space-y-3">
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
                onAddNew={() => onAddNewPassengerForSeat(seat)}
              />
            </div>
          ))}
      </div>
    </div>
  )
}
