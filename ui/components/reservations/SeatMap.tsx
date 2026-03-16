"use client"

import { cn } from "@/lib/utils"
import type { SeatInfo, Reservation } from "@/types"

interface SeatMapProps {
  seats: SeatInfo[]
  capacity: number
  onSeatClick: (seatNumber: number, reservation?: Reservation) => void
  allowMultiSelect?: boolean
  selectedSeats?: number[]
}

function getSeatColors(status: SeatInfo["status"]): {
  bg: string
  border: string
  text: string
  hover: string
} {
  switch (status) {
    case "available":
      return {
        bg: "bg-green-100",
        border: "border-green-500",
        text: "text-green-900",
        hover: "hover:brightness-95",
      }
    case "reserved":
      return {
        bg: "bg-red-100",
        border: "border-red-500",
        text: "text-red-800",
        hover: "hover:brightness-95 cursor-pointer",
      }
    case "selected":
      return {
        bg: "bg-blue-100",
        border: "border-blue-500",
        text: "text-blue-800",
        hover: "hover:brightness-95",
      }
    default:
      return {
        bg: "bg-slate-100",
        border: "border-slate-300",
        text: "text-slate-400",
        hover: "",
      }
  }
}

interface SeatProps {
  seat: SeatInfo
  isSelected: boolean
  onClick: () => void
  allowMultiSelect: boolean
}

function Seat({ seat, isSelected, onClick, allowMultiSelect }: SeatProps) {
  const displayStatus =
    isSelected && seat.status === "available" ? "selected" : seat.status
  const colors = getSeatColors(displayStatus)
  const fullName = seat.reservation
    ? `${seat.reservation.passenger.firstName} ${seat.reservation.passenger.lastName}`
    : "Slobodno sedište"
  const phone = seat.reservation?.passenger.phone ?? "-"

  const title =
    seat.status === "reserved" && seat.reservation
      ? `${seat.reservation.passenger.firstName} ${seat.reservation.passenger.lastName}`
      : displayStatus === "selected"
      ? allowMultiSelect
        ? "Dodato u izbor"
        : "Izabrano"
      : "Slobodno"

  return (
    <button
      type="button"
      className={cn(
        "w-28 min-h-[4.25rem] rounded-md border-2 p-1.5 text-left select-none transition-transform cursor-pointer",
        colors.bg,
        colors.border,
        colors.text,
        colors.hover,
        "active:scale-95"
      )}
      onClick={onClick}
      title={title}
    >
      <p className="text-[9px] font-semibold uppercase opacity-80">Sedište {seat.seatNumber}</p>
      <p className="mt-1 text-[10px] font-semibold leading-tight">{fullName}</p>
      <p className="mt-0.5 text-[10px] leading-tight">{phone}</p>
    </button>
  )
}

export function SeatMap({
  seats,
  capacity,
  onSeatClick,
  allowMultiSelect = false,
  selectedSeats = [],
}: SeatMapProps) {
  // Bus layout: 2+2 per column (top-2 + aisle + bottom-2)
  // Seats are grouped by columns of 4 and rendered top->bottom as:
  // col 1: 4, 3, 2, 1
  // col 2: 8, 7, 6, 5 ...

  // Sort seats by number
  const sortedSeats = [...seats].sort((a, b) => a.seatNumber - b.seatNumber)

  // Divide into columns of 4
  const cols: { topWindow: SeatInfo | null; topAisle: SeatInfo | null; bottomAisle: SeatInfo | null; bottomWindow: SeatInfo | null }[] = []
  for (let i = 0; i < capacity; i += 4) {
    cols.push({
      topWindow:    sortedSeats[i + 3] ?? null, // e.g. 4, 8, 12 ...
      topAisle:     sortedSeats[i + 2] ?? null, // e.g. 3, 7, 11 ...
      bottomAisle:  sortedSeats[i + 1] ?? null, // e.g. 2, 6, 10 ...
      bottomWindow: sortedSeats[i]     ?? null, // e.g. 1, 5, 9  ...
    })
  }

  const renderSeat = (seat: SeatInfo | null) => {
    if (!seat) return <div className="w-28 min-h-[4.25rem]" />
    const isSelected = selectedSeats.includes(seat.seatNumber) || !!seat.isSelected
    return (
      <Seat
        key={seat.seatNumber}
        seat={seat}
        isSelected={isSelected}
        onClick={() => onSeatClick(seat.seatNumber, seat.reservation)}
        allowMultiSelect={allowMultiSelect}
      />
    )
  }

  return (
    <div className="w-full min-w-0 space-y-4">
      {/* Bus body */}
      <div className="w-full max-w-full rounded-2xl border-2 border-slate-300 bg-slate-100 p-6 overflow-x-auto">
        <div className="flex w-max items-start">
          {/* Seat columns */}
          <div className="flex gap-2">
            {cols.map((col, i) => (
              <div key={i} className="flex flex-col items-center gap-1">
                {/* Top window row */}
                {renderSeat(col.topWindow)}
                {/* Top aisle row */}
                {renderSeat(col.topAisle)}
                {/* Aisle gap */}
                <div className="h-4" />
                {/* Bottom aisle row */}
                {renderSeat(col.bottomAisle)}
                {/* Bottom window row */}
                {renderSeat(col.bottomWindow)}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-4 text-sm text-muted-foreground pt-1">
        <LegendItem fill="#bbf7d0" stroke="#22c55e" label="Slobodno sedište" />
        <LegendItem fill="#fecaca" stroke="#f87171" label="Rezervisano sedište" />
        {allowMultiSelect && (
          <LegendItem fill="#bfdbfe" stroke="#3b82f6" label="Izabrano sedište" />
        )}
      </div>
    </div>
  )
}

function LegendItem({ fill, stroke, label }: { fill: string; stroke: string; label: string }) {
  return (
    <div className="flex items-center gap-2">
      <div
        className="w-5 h-5 rounded-sm border-2 shrink-0"
        style={{ backgroundColor: fill, borderColor: stroke }}
      >
      </div>
      <span>{label}</span>
    </div>
  )
}
