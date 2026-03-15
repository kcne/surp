import Image from "next/image"
import { Armchair, Clock3, Info, Route, Ticket } from "lucide-react"
import { Button } from "@/components/ui/button"
import type { RideInstance } from "@/types"
import { formatTimeDisplay } from "@/utils/dateHelpers"

interface RideInstanceCardProps {
  instance: RideInstance
  isPastRide: boolean
  durationLabel: string | null
  onViewInfo: (instance: RideInstance) => void
  onReserve: (instance: RideInstance) => void
}

export function RideInstanceCard({
  instance,
  isPastRide,
  durationLabel,
  onViewInfo,
  onReserve,
}: RideInstanceCardProps) {
  const capacity = instance.ride.busCapacity
  const reserved = instance.reservationCount || 0
  const available = capacity - reserved

  return (
    <div className="w-full rounded-lg border bg-background p-4 shadow-sm">
      <div className="grid gap-5 md:grid-cols-[auto_1.6fr_1fr_1fr_auto] md:items-center">
        <div className="flex justify-start">
          <Image
            src="/uvs-logo.svg"
            alt="Company logo"
            width={132}
            height={32}
            className="h-8 w-auto"
          />
        </div>

        <div className="space-y-1">
          <p className="inline-flex items-center gap-1 text-xs font-semibold uppercase text-muted-foreground">
            <Route className="h-3.5 w-3.5" />
            Vožnja:
          </p>
          <p className="text-base font-semibold">
            {instance.ride.line.departureStation.name} -&gt; {instance.ride.line.arrivalStation.name}
          </p>
        </div>

        <div className="space-y-1">
          <p className="inline-flex items-center gap-1 text-xs font-semibold uppercase text-muted-foreground">
            <Clock3 className="h-3.5 w-3.5" />
            Vreme:
          </p>
          <p className="text-base font-semibold">{formatTimeDisplay(instance.departureTime)}</p>
          {durationLabel && <p className="text-sm text-muted-foreground">({durationLabel})</p>}
        </div>

        <div className="space-y-1">
          <p className="inline-flex items-center gap-1 text-xs font-semibold uppercase text-muted-foreground">
            <Armchair className="h-3.5 w-3.5" />
            Slobodno:
          </p>
          <p className="text-base font-semibold">
            {available}/{capacity}
          </p>
        </div>

        <div className="space-y-2">
          <div className="flex flex-col gap-2">
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
