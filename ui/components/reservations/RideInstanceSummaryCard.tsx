import { Armchair, CalendarClock, Download, Eraser, Info, Route, Ticket } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import type { RideInstance } from "@/types"
import { formatTimeDisplay } from "@/utils/dateHelpers"

interface RideInstanceSummaryCardProps {
  selectedRideInstance: RideInstance
  routeName: string
  localizedRideDate: string
  reservedCount: number
  totalSeats: number
  selectedSeats: number[]
  onClearSelectedSeats: () => void
  onReserveSelectedSeats: () => void
  onExport: () => void
}

export function RideInstanceSummaryCard({
  selectedRideInstance,
  routeName,
  localizedRideDate,
  reservedCount,
  totalSeats,
  selectedSeats,
  onClearSelectedSeats,
  onReserveSelectedSeats,
  onExport,
}: RideInstanceSummaryCardProps) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-4">
          <div>
            <CardTitle className="flex items-center gap-2 text-xl font-bold">
              <Route className="h-5 w-5 text-primary" />
              {routeName}
            </CardTitle>
            <CardDescription className="mt-2 space-y-1">
              <p className="flex items-center gap-2">
                <Route className="h-4 w-4 text-muted-foreground" />
                <span className="font-semibold">Ime linije:</span>{" "}
                {selectedRideInstance.ride.line.name}
              </p>
              <p className="flex items-center gap-2">
                <CalendarClock className="h-4 w-4 text-muted-foreground" />
                <span className="font-semibold">Datum i vreme polaska:</span>{" "}
                <span className="font-semibold">
                  {localizedRideDate} {formatTimeDisplay(selectedRideInstance.departureTime)}
                </span>
              </p>
              <p className="flex items-center gap-2">
                <Armchair className="h-4 w-4 text-muted-foreground" />
                <span className="font-semibold">Sedišta (total/reserved):</span>{" "}
                {totalSeats}/{reservedCount}
              </p>
            </CardDescription>
          </div>
          <Button onClick={onExport} variant="outline">
            <Download className="mr-2 h-4 w-4" />
            Izvezi listu putnika
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-1">
        <CardTitle className="flex items-center gap-2 text-base">
          <Armchair className="h-4 w-4 text-primary" />
          Izabrana sedišta
        </CardTitle>
        <CardDescription className="leading-tight text-xs">
          {selectedSeats.length === 0
            ? "Izaberite sedišta iz mape ispod."
            : selectedSeats.length === 1
            ? "Jedno sedište je izabrano."
            : `${selectedSeats.length} sedišta su izabrana.`}
        </CardDescription>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap gap-2">
            {selectedSeats.length === 0 ? (
              <Badge variant="outline" className="inline-flex items-center gap-1">
                <Info className="h-3 w-3" />
                Nema izabranih sedišta
              </Badge>
            ) : (
              selectedSeats
                .slice()
                .sort((left, right) => left - right)
                .map((seatNumber) => (
                  <Badge key={seatNumber} variant="secondary" className="inline-flex items-center gap-1">
                    <Armchair className="h-3 w-3" />
                    Sedište {seatNumber}
                  </Badge>
                ))
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClearSelectedSeats} disabled={selectedSeats.length === 0}>
              <Eraser className="mr-2 h-4 w-4" />
              Očisti
            </Button>
            <Button onClick={onReserveSelectedSeats} disabled={selectedSeats.length === 0}>
              <Ticket className="mr-2 h-4 w-4" />
              Rezerviši
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
