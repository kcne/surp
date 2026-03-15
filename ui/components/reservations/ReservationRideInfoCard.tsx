import type { RideInstance } from "@/types"
import { formatDateDisplay, formatTimeDisplay } from "@/utils/dateHelpers"
import { Armchair, Bus, Calendar as CalendarIcon, Clock } from "lucide-react"

interface ReservationRideInfoCardProps {
  rideInstance: RideInstance
  seatDisplay: string
}

export function ReservationRideInfoCard({
  rideInstance,
  seatDisplay,
}: ReservationRideInfoCardProps) {
  return (
    <div className="space-y-2 rounded-lg border bg-gray-50 p-4 text-sm">
      <div className="flex items-center gap-2">
        <Bus className="h-4 w-4 text-muted-foreground" />
        <p>
          <span className="font-semibold">Vožnja:</span> {rideInstance.ride.line.name}
        </p>
      </div>
      <div className="flex items-center gap-2">
        <CalendarIcon className="h-4 w-4 text-muted-foreground" />
        <p>
          <span className="font-semibold">Datum:</span> {formatDateDisplay(new Date(rideInstance.date))}
        </p>
      </div>
      <div className="flex items-center gap-2">
        <Clock className="h-4 w-4 text-muted-foreground" />
        <p>
          <span className="font-semibold">Vreme:</span>{" "}
          {formatTimeDisplay(rideInstance.departureTime)} - {formatTimeDisplay(rideInstance.arrivalTime)}
        </p>
      </div>
      <div className="flex items-center gap-2">
        <Armchair className="h-4 w-4 text-muted-foreground" />
        <p>
          <span className="font-semibold">Sedište:</span> {seatDisplay}
        </p>
      </div>
    </div>
  )
}
