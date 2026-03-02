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

// SVG seat icon — the provided bus seat shape
function SeatIcon({ fill, stroke }: { fill: string; stroke: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 100 100"
      className="w-full h-full"
      aria-hidden="true"
    >
      <path
        d="M87.7,12.5c-0.8-3.7-4.1-6.6-8.2-6.6H36.9c-4,0-7.4,2.8-8.2,6.5h-17C8,12.5,5,15.4,5,19.1v61.7
          c0,3.7,3,6.6,6.7,6.6h16.9c0.7,3.9,4.1,6.8,8.2,6.8h42.7c3.8,0,7-2.5,8-5.8c4.2-0.4,7.5-3.9,7.5-8.2V20.6
          C95,16.5,91.8,13,87.7,12.5z M36.9,8.8h42.7c2.5,0,4.5,1.6,5.2,3.8c-3.3,0.8-5.8,3.5-6.3,6.8H36.9
          c-3,0-5.4-2.4-5.4-5.3S33.9,8.8,36.9,8.8z M28.7,84.5h-17c-2.1,0-3.8-1.7-3.8-3.7V19.1c0-2.1,1.7-3.7,3.8-3.7h16.9
          c0.6,4,4.1,7,8.2,7h41.4v55.5H36.9C32.8,77.8,29.4,80.7,28.7,84.5z M79.5,91.4H36.9c-3,0-5.4-2.4-5.4-5.3
          s2.4-5.3,5.4-5.3h41.5c0.2,3.6,2.8,6.5,6.2,7.4C83.7,90,81.8,91.4,79.5,91.4z M92.1,80.2c0,2.9-2.4,5.3-5.4,5.3
          s-5.4-2.4-5.4-5.3V20.6c0-2.9,2.4-5.3,5.4-5.3s5.4,2.4,5.4,5.3V80.2z"
        fill={fill}
        stroke={stroke}
        strokeWidth="1"
      />
    </svg>
  )
}

function getSeatColors(status: SeatInfo["status"]): {
  fill: string
  stroke: string
  text: string
  hover: string
} {
  switch (status) {
    case "available":
      return {
        fill: "#bbf7d0",
        stroke: "#22c55e",
        text: "text-green-900",
        hover: "hover:brightness-95",
      }
    case "reserved":
      return {
        fill: "#fecaca",
        stroke: "#f87171",
        text: "text-red-800",
        hover: "hover:brightness-95 cursor-pointer",
      }
    case "selected":
      return {
        fill: "#bfdbfe",
        stroke: "#3b82f6",
        text: "text-blue-800",
        hover: "hover:brightness-95",
      }
    default:
      return {
        fill: "#f1f5f9",
        stroke: "#cbd5e1",
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

  const title =
    seat.status === "reserved" && seat.reservation
      ? `${seat.reservation.passenger.firstName} ${seat.reservation.passenger.lastName}`
      : displayStatus === "selected"
      ? allowMultiSelect
        ? "Dodato u izbor"
        : "Izabrano"
      : "Slobodno"

  return (
    <div
      className={cn(
        "relative flex items-center justify-center w-12 h-12 select-none transition-transform cursor-pointer",
        colors.hover,
        "active:scale-95"
      )}
      onClick={onClick}
      title={title}
    >
      <SeatIcon fill={colors.fill} stroke={colors.stroke} />
      {/* Seat number centered over the SVG */}
      <span
        className={cn(
          "absolute inset-0 flex items-center justify-center font-bold text-xs leading-none pb-1",
          colors.text
        )}
        style={{ paddingLeft: "18%", paddingBottom: "8%" }}
      >
        {seat.seatNumber}
      </span>
    </div>
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
    if (!seat) return <div className="w-12 h-12" />
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
    <div className="space-y-4">
      {/* Bus body */}
      <div className="rounded-2xl border-2 border-slate-300 bg-slate-100 p-6 overflow-x-auto">
        {/* Driver area hint */}
        <div className="flex gap-3 items-start">
          {/* Steering wheel column */}
          <div className="flex flex-col items-center justify-center w-10 shrink-0 self-stretch">
            <svg viewBox="0 0 24 24" className="w-8 h-8 text-slate-400" fill="none" stroke="currentColor" strokeWidth="1.5">
              <circle cx="12" cy="12" r="9" />
              <circle cx="12" cy="12" r="3" />
              <line x1="12" y1="3" x2="12" y2="9" />
              <line x1="3.5" y1="17" x2="8.5" y2="13.5" />
              <line x1="20.5" y1="17" x2="15.5" y2="13.5" />
            </svg>
          </div>

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
      <div className="w-6 h-6 shrink-0">
        <SeatIcon fill={fill} stroke={stroke} />
      </div>
      <span>{label}</span>
    </div>
  )
}
