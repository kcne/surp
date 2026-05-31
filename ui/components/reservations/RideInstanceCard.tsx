import { ArrowRight, Clock, Info, Ticket } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import type { RideInstance } from "@/types"
import { formatTimeDisplay } from "@/utils/dateHelpers"
import {
  OccupancyMeter,
  RideStatusBadge,
  RouteLine,
  deriveRideDisplayStatus,
} from "@/components/reservations/primitives"

interface RideInstanceCardProps {
  instance: RideInstance
  durationLabel: string | null
  onViewInfo: (instance: RideInstance) => void
  onReserve: (instance: RideInstance) => void
}

export function RideInstanceCard({
  instance,
  durationLabel,
  onViewInfo,
  onReserve,
}: RideInstanceCardProps) {
  const capacity = instance.ride.busCapacity
  const reserved = instance.reservationCount || 0
  const displayStatus = deriveRideDisplayStatus(instance.status, instance.date)
  const isInactive =
    displayStatus === "cancelled" ||
    displayStatus === "completed" ||
    displayStatus === "past"
  const reserveDisabled = isInactive
  const disabledReason =
    displayStatus === "cancelled"
      ? "Vožnja je otkazana"
      : displayStatus === "completed"
      ? "Vožnja je završena"
      : displayStatus === "past"
      ? "Rezervacija za prošle vožnje nije moguća"
      : undefined

  const intermediateStops = instance.ride.line.intermediateStations.length

  return (
    <div
      className={cn(
        "w-full rounded-lg border bg-card p-4 shadow-sm transition-colors hover:border-primary/40 md:p-5",
        isInactive && "opacity-75",
      )}
    >
      <div className="grid gap-4 md:grid-cols-[1.6fr_1.6fr_auto] md:items-center md:gap-6">
        <div className="flex min-w-0 flex-col gap-2">
          <RideStatusBadge
            status={instance.status}
            rideDate={instance.date}
            size="sm"
            className="self-start"
          />
          <RouteLine
            from={instance.ride.line.departureStation.name}
            to={instance.ride.line.arrivalStation.name}
            intermediateStops={intermediateStops}
            durationLabel={durationLabel}
          />
          <p className="truncate text-xs text-muted-foreground" title={instance.ride.line.name}>
            Linija: {instance.ride.line.name}
          </p>
        </div>

        <div className="grid grid-cols-[auto_auto_1fr] items-center gap-x-3 gap-y-2 sm:gap-x-4">
          <span className="inline-flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            <Clock className="h-3.5 w-3.5" />
            Polazak
          </span>
          <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
          <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Dolazak
          </span>
          <span className="text-xl font-semibold tabular-nums">
            {formatTimeDisplay(instance.departureTime)}
          </span>
          <ArrowRight className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
          <span className="text-xl font-semibold tabular-nums">
            {formatTimeDisplay(instance.arrivalTime)}
          </span>

          <span className="col-span-3 mt-1">
            <OccupancyMeter
              reserved={reserved}
              capacity={capacity}
              inactive={isInactive}
            />
          </span>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row md:flex-col md:justify-self-end">
          <Button variant="outline" size="sm" onClick={() => onViewInfo(instance)}>
            <Info className="mr-2 h-4 w-4" />
            Više informacija
          </Button>
          <Button
            size="sm"
            onClick={() => onReserve(instance)}
            disabled={reserveDisabled}
            title={disabledReason}
          >
            <Ticket className="mr-2 h-4 w-4" />
            Rezerviši
          </Button>
        </div>
      </div>
    </div>
  )
}
