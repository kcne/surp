import { Armchair, Eraser, Info, Ticket } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardTitle } from "@/components/ui/card"

interface SelectedSeatsCardProps {
  selectedSeats: number[]
  onClear: () => void
  onReserve: () => void
}

export function SelectedSeatsCard({ selectedSeats, onClear, onReserve }: SelectedSeatsCardProps) {
  return (
    <Card>
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
            <Button variant="outline" onClick={onClear} disabled={selectedSeats.length === 0}>
              <Eraser className="mr-2 h-4 w-4" />
              Očisti
            </Button>
            <Button onClick={onReserve} disabled={selectedSeats.length === 0}>
              <Ticket className="mr-2 h-4 w-4" />
              Rezerviši
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
