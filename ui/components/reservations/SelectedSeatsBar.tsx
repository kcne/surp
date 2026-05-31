"use client"

import { Armchair, Eraser, Ticket, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

interface SelectedSeatsBarProps {
  selectedSeats: number[]
  onRemoveSeat: (seatNumber: number) => void
  onClear: () => void
  onReserve: () => void
  className?: string
}

export function SelectedSeatsBar({
  selectedSeats,
  onRemoveSeat,
  onClear,
  onReserve,
  className,
}: SelectedSeatsBarProps) {
  if (selectedSeats.length === 0) return null

  const sortedSeats = [...selectedSeats].sort((a, b) => a - b)

  return (
    <div
      className={cn(
        "sticky bottom-4 z-30 mt-2",
        className,
      )}
    >
      <div className="flex flex-wrap items-center gap-3 rounded-xl border bg-background/95 p-3 shadow-lg backdrop-blur-sm sm:flex-nowrap">
        <div className="flex shrink-0 items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Armchair className="h-4 w-4" aria-hidden="true" />
          </div>
          <div className="leading-tight">
            <p className="text-sm font-semibold tabular-nums">
              {sortedSeats.length}{" "}
              <span className="font-normal text-muted-foreground">
                {sortedSeats.length === 1 ? "izabrano sedište" : "izabrana sedišta"}
              </span>
            </p>
            <p className="text-[11px] text-muted-foreground">
              Kliknite × da uklonite pojedinačno sedište
            </p>
          </div>
        </div>

        <div className="flex min-w-0 flex-1 flex-wrap gap-1.5">
          {sortedSeats.map((seatNumber) => (
            <button
              key={seatNumber}
              type="button"
              onClick={() => onRemoveSeat(seatNumber)}
              className="group inline-flex items-center gap-1 rounded-full border border-primary/30 bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary transition-colors hover:bg-primary/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              aria-label={`Ukloni sedište ${seatNumber}`}
            >
              <span className="tabular-nums">Sedište {seatNumber}</span>
              <X className="h-3 w-3 opacity-70 group-hover:opacity-100" aria-hidden="true" />
            </button>
          ))}
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <Button variant="outline" size="sm" onClick={onClear}>
            <Eraser className="mr-1.5 h-3.5 w-3.5" />
            Očisti
          </Button>
          <Button size="sm" onClick={onReserve}>
            <Ticket className="mr-1.5 h-3.5 w-3.5" />
            Rezerviši ({sortedSeats.length})
          </Button>
        </div>
      </div>
    </div>
  )
}
