import { BusFront, CalendarDays, Clock, Download, MapPin, Timer, Users } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { OccupancyMeter } from "@/components/reservations/primitives/OccupancyMeter"
import { RideStatusBadge } from "@/components/reservations/primitives/RideStatusBadge"
import { RouteLine } from "@/components/reservations/primitives/RouteLine"
import { StatCard } from "@/components/reservations/primitives/StatCard"
import type { RideInstance } from "@/types"
import { formatDuration } from "@/utils/dateHelpers"

interface RideInstanceSummaryCardProps {
  selectedRideInstance: RideInstance
  routeName: string
  localizedRideDate: string
  reservedCount: number
  totalSeats: number
  onExport: () => void
}

function computeDurationMinutes(departureTime: string, arrivalTime: string): number | undefined {
  const [dh, dm] = departureTime.split(":").map(Number)
  const [ah, am] = arrivalTime.split(":").map(Number)
  if ([dh, dm, ah, am].some((value) => Number.isNaN(value))) return undefined
  let diff = (ah * 60 + am) - (dh * 60 + dm)
  if (diff < 0) diff += 24 * 60
  return diff
}

export function RideInstanceSummaryCard({
  selectedRideInstance,
  routeName,
  localizedRideDate,
  reservedCount,
  totalSeats,
  onExport,
}: RideInstanceSummaryCardProps) {
  const { ride, departureTime, arrivalTime, status, date } = selectedRideInstance
  const lineName = ride.line.name
  const fromCity = ride.line.departureStation.name
  const toCity = ride.line.arrivalStation.name
  const intermediateStops = ride.line.intermediateStations.length
  const durationMinutes =
    computeDurationMinutes(departureTime, arrivalTime) ?? ride.line.duration
  const durationLabel = formatDuration(durationMinutes)
  const availableSeats = Math.max(totalSeats - reservedCount, 0)

  return (
    <Card>
      <CardHeader className="space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 flex-1 space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1 rounded-full border border-border bg-muted/60 px-2 py-0.5 text-[11px] font-semibold text-muted-foreground">
                <BusFront className="h-3 w-3" aria-hidden="true" />
                Bus
              </span>
              <RideStatusBadge status={status} rideDate={date} />
              <span className="text-xs font-medium text-muted-foreground">
                {lineName}
              </span>
            </div>
            <h1 className="text-xl font-bold tracking-tight sm:text-2xl">{routeName}</h1>
            <RouteLine
              from={fromCity}
              to={toCity}
              intermediateStops={intermediateStops}
              durationLabel={durationLabel}
            />
          </div>
          <Button variant="outline" onClick={onExport} className="shrink-0">
            <Download className="mr-2 h-4 w-4" />
            Izvezi listu putnika
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          <StatCard
            icon={CalendarDays}
            label="Datum"
            value={<span className="text-sm sm:text-base">{localizedRideDate}</span>}
          />
          <StatCard
            icon={Clock}
            label="Polazak"
            value={departureTime}
            helper={fromCity}
          />
          <StatCard
            icon={MapPin}
            label="Dolazak"
            value={arrivalTime}
            helper={toCity}
          />
          <StatCard
            icon={Timer}
            label="Trajanje"
            value={durationLabel ?? "—"}
            tone={durationLabel ? "default" : "muted"}
          />
          <StatCard
            icon={Users}
            label="Slobodno"
            value={`${availableSeats}/${totalSeats}`}
            tone={availableSeats === 0 ? "danger" : availableSeats <= totalSeats * 0.2 ? "warning" : "success"}
            helper={
              <OccupancyMeter
                reserved={reservedCount}
                capacity={totalSeats}
                hideCount
              />
            }
          />
        </div>
      </CardContent>
    </Card>
  )
}
