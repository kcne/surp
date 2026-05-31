import { Armchair, CalendarDays, Clock } from "lucide-react"
import type { RideInstance } from "@/types"
import { formatDateDisplay } from "@/utils/dateHelpers"
import { RideStatusBadge } from "@/components/reservations/primitives/RideStatusBadge"
import { RouteLine } from "@/components/reservations/primitives/RouteLine"

interface ReservationRideInfoCardProps {
  rideInstance: RideInstance
  seatDisplay: string
}

export function ReservationRideInfoCard({
  rideInstance,
  seatDisplay,
}: ReservationRideInfoCardProps) {
  const { ride, departureTime, arrivalTime, date, status } = rideInstance
  const fromCity = ride.line.departureStation.name
  const toCity = ride.line.arrivalStation.name
  const intermediateStops = ride.line.intermediateStations.length
  const seatLabel = seatDisplay
    ? seatDisplay.includes(",")
      ? `Sedišta ${seatDisplay}`
      : `Sedište ${seatDisplay}`
    : null

  return (
    <div className="rounded-lg border bg-muted/30 p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <RideStatusBadge status={status} rideDate={date} size="sm" />
          <span className="text-xs font-medium text-muted-foreground">{ride.line.name}</span>
        </div>
        {seatLabel && (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-2.5 py-0.5 text-xs font-semibold text-primary">
            <Armchair className="h-3.5 w-3.5" aria-hidden="true" />
            {seatLabel}
          </span>
        )}
      </div>

      <RouteLine
        from={fromCity}
        to={toCity}
        intermediateStops={intermediateStops}
        size="sm"
      />

      <dl className="mt-3 grid grid-cols-2 gap-3 text-xs sm:grid-cols-3">
        <div className="flex items-center gap-2">
          <CalendarDays className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
          <div>
            <dt className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              Datum
            </dt>
            <dd className="font-semibold tabular-nums">{formatDateDisplay(new Date(date))}</dd>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Clock className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
          <div>
            <dt className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              Polazak
            </dt>
            <dd className="font-semibold tabular-nums">{departureTime}</dd>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Clock className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
          <div>
            <dt className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              Dolazak
            </dt>
            <dd className="font-semibold tabular-nums">{arrivalTime}</dd>
          </div>
        </div>
      </dl>
    </div>
  )
}
