/* eslint-disable @next/next/no-img-element */
import { Armchair, Clock3, Info, Route, Ticket } from "lucide-react"
import { Button } from "@/components/ui/button"
import type { RideInstance } from "@/types"
import { formatTimeDisplay } from "@/utils/dateHelpers"

interface RideInstanceCardProps {
  instance: RideInstance
  rideIconUrl?: string | null
  isPastRide: boolean
  durationLabel: string | null
  onViewInfo: (instance: RideInstance) => void
  onReserve: (instance: RideInstance) => void
}

export function RideInstanceCard({
  instance,
  rideIconUrl,
  isPastRide,
  durationLabel,
  onViewInfo,
  onReserve,
}: RideInstanceCardProps) {
  const capacity = instance.ride.busCapacity
  const reserved = instance.reservationCount || 0
  const available = capacity - reserved
  const availableTextClass = available > 0 ? "text-green-600" : "text-red-600"
  const iconSrc = rideIconUrl || "/reservations/ride-card-icon.svg"

  return (
    <div className="w-full rounded-lg border bg-background p-4 shadow-sm md:p-5">
      <div className="grid gap-4 md:grid-cols-[auto_1.6fr_1.8fr_auto] md:items-center md:gap-6">
        <div className="flex justify-start">
          <img
            src={iconSrc}
            alt="Ikonica rezervacije vožnje"
            className="h-14 w-auto max-w-[132px] object-contain"
          />
        </div>

        <div className="space-y-1.5">
          <p className="inline-flex items-center gap-1 text-sm font-semibold uppercase text-muted-foreground">
            <Route className="h-4 w-4" />
            Vožnja:
          </p>
          <p className="text-lg font-semibold">
            {instance.ride.line.departureStation.name} -&gt; {instance.ride.line.arrivalStation.name}
          </p>
        </div>

        <div className="space-y-2">
          <div className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-3">
            <div className="space-y-0.5">
              <p className="inline-flex items-center gap-1 text-sm font-semibold uppercase text-muted-foreground">
                <Clock3 className="h-3 w-3" />
                Polazak:
              </p>
              <p className="text-xl font-semibold text-muted-foreground pl-4">{formatTimeDisplay(instance.departureTime)}</p>
            </div>
            <div className="space-y-0.5">
              <p className="inline-flex items-center gap-1 text-sm font-semibold uppercase text-muted-foreground">
                <Clock3 className="h-3 w-3" />
                Dolazak:
              </p>
              <p className="text-xl font-semibold text-muted-foreground pl-4">{formatTimeDisplay(instance.arrivalTime)}</p>
            </div>
            <div className="space-y-0.5">
              <p className="inline-flex items-center gap-1 text-sm font-semibold uppercase text-muted-foreground">
                <Armchair className="h-4 w-4" />
                Slobodno:
              </p>
              <p className={`text-xl font-semibold ${availableTextClass} pl-8`}>{available}</p>
            </div>
          </div>
          {durationLabel && <p className="text-sm text-muted-foreground ">({durationLabel})</p>}
        </div>

        <div className="space-y-2 md:justify-self-end">
          <div className="flex flex-col gap-2 sm:flex-row md:flex-col">
            <Button variant="outline" size="sm" onClick={() => onViewInfo(instance)}>
              <Info className="mr-2 h-4 w-4" />
              Više informacija
            </Button>
            <Button
              size="sm"
              onClick={() => onReserve(instance)}
              disabled={instance.status === "cancelled" || isPastRide}
              title={isPastRide ? "Rezervacija za prošle vožnje nije moguća" : undefined}
            >
              <Ticket className="mr-2 h-4 w-4" />
              Rezerviši
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
