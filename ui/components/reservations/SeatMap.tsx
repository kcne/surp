"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { ArrowDown, ArrowUp, Search, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import type { SeatInfo, Reservation } from "@/types"

interface SeatMapProps {
  seats: SeatInfo[]
  capacity: number
  onSeatClick: (seatNumber: number, reservation?: Reservation) => void
  allowMultiSelect?: boolean
  selectedSeats?: number[]
  groupLabelByGroupId?: Map<string, string>
}

function normalize(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
}

type SeatVisualStatus = SeatInfo["status"] | "selected"

function getSeatClasses(status: SeatVisualStatus, interactive: boolean): string {
  switch (status) {
    case "available":
      return cn(
        "border-success/60 bg-success/15",
        interactive && "hover:border-success hover:bg-success/25 hover:shadow-sm",
      )
    case "reserved":
      return cn(
        "border-danger/50 bg-danger/15",
        interactive && "hover:border-danger hover:bg-danger/25 hover:shadow-sm",
      )
    case "selected":
      return cn(
        "border-primary bg-primary/20 shadow-md ring-2 ring-primary/40",
        interactive && "hover:bg-primary/25",
      )
    default:
      return "border-muted bg-muted/40"
  }
}

interface SeatProps {
  seat: SeatInfo
  isSelected: boolean
  onClick: () => void
  allowMultiSelect: boolean
  highlight?: "match" | "current" | null
  groupLabel?: string | null
}

function Seat({ seat, isSelected, onClick, allowMultiSelect, highlight, groupLabel }: SeatProps) {
  const displayStatus: SeatVisualStatus =
    isSelected && seat.status === "available" ? "selected" : seat.status
  const fullName = seat.reservation
    ? `${seat.reservation.passenger.firstName} ${seat.reservation.passenger.lastName}`
    : "Slobodno"
  const phone = seat.reservation?.passenger.phone ?? null

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
      data-seat-number={seat.seatNumber}
      aria-pressed={displayStatus === "selected"}
      aria-label={`Sedište ${seat.seatNumber}: ${title}`}
      className={cn(
        "relative flex h-[4.5rem] w-28 cursor-pointer select-none flex-col rounded-lg border-2 p-1.5 text-left text-foreground transition-all active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
        getSeatClasses(displayStatus, true),
        highlight === "match" && "ring-2 ring-amber-400 ring-offset-1",
        highlight === "current" && "ring-4 ring-amber-500 ring-offset-2 shadow-lg",
      )}
      onClick={onClick}
      title={title}
    >
      <span
        className={cn(
          "flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide tabular-nums",
          displayStatus === "available" && "text-emerald-900",
          displayStatus === "reserved" && "text-red-900",
          displayStatus === "selected" && "text-blue-900",
        )}
      >
        <span>#{seat.seatNumber}</span>
        {groupLabel && (
          <span
            className="rounded bg-red-900/15 px-1 py-px text-[9px] font-bold leading-none text-red-900"
            title={`Putuju zajedno (${groupLabel})`}
          >
            {groupLabel}
          </span>
        )}
      </span>
      <span
        className={cn(
          "mt-0.5 line-clamp-2 text-[11px] font-semibold leading-tight",
          displayStatus === "available" && "text-emerald-900",
          displayStatus === "reserved" && "text-red-900",
          displayStatus === "selected" && "text-blue-900",
        )}
      >
        {fullName}
      </span>
      {phone && (
        <span
          className={cn(
            "mt-auto truncate text-[10px] leading-tight tabular-nums",
            displayStatus === "available" && "text-emerald-800",
            displayStatus === "reserved" && "text-red-800",
            displayStatus === "selected" && "text-blue-800",
          )}
        >
          {phone}
        </span>
      )}
      {displayStatus === "selected" && (
        <span
          className="absolute right-1 top-1 inline-flex h-3.5 w-3.5 items-center justify-center rounded-full bg-primary text-[8px] font-bold leading-none text-primary-foreground"
          aria-hidden="true"
        >
          ✓
        </span>
      )}
    </button>
  )
}

export function SeatMap({
  seats,
  capacity,
  onSeatClick,
  allowMultiSelect = false,
  selectedSeats = [],
  groupLabelByGroupId,
}: SeatMapProps) {
  const gridRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const [query, setQuery] = useState("")
  const [currentMatchIndex, setCurrentMatchIndex] = useState(0)

  const sortedSeats = useMemo(
    () => [...seats].sort((a, b) => a.seatNumber - b.seatNumber),
    [seats],
  )

  const reservedSeatsWithIndex = useMemo(
    () =>
      sortedSeats
        .map((seat) => {
          if (!seat.reservation) return null
          const passenger = seat.reservation.passenger
          const haystack = normalize(
            `${passenger.firstName} ${passenger.lastName} ${passenger.phone ?? ""}`,
          )
          return { seatNumber: seat.seatNumber, haystack }
        })
        .filter((entry): entry is { seatNumber: number; haystack: string } => entry !== null),
    [sortedSeats],
  )

  const matches = useMemo(() => {
    const trimmed = query.trim()
    if (!trimmed) return [] as number[]
    const needle = normalize(trimmed)
    return reservedSeatsWithIndex
      .filter((entry) => entry.haystack.includes(needle))
      .map((entry) => entry.seatNumber)
  }, [query, reservedSeatsWithIndex])

  const matchSet = useMemo(() => new Set(matches), [matches])
  const currentMatchSeatNumber =
    matches.length > 0 ? matches[currentMatchIndex % matches.length] : null

  // Reset cycle index when query changes
  useEffect(() => {
    setCurrentMatchIndex(0)
  }, [query])

  // Scroll current match into view
  useEffect(() => {
    if (currentMatchSeatNumber == null) return
    const node = gridRef.current?.querySelector<HTMLButtonElement>(
      `[data-seat-number="${currentMatchSeatNumber}"]`,
    )
    node?.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" })
  }, [currentMatchSeatNumber])

  const cycleMatch = (delta: number) => {
    if (matches.length === 0) return
    setCurrentMatchIndex((prev) => (prev + delta + matches.length) % matches.length)
  }

  const handleSearchKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter" || event.key === "ArrowDown") {
      event.preventDefault()
      cycleMatch(1)
    } else if (event.key === "ArrowUp") {
      event.preventDefault()
      cycleMatch(-1)
    } else if (event.key === "Escape") {
      event.preventDefault()
      setQuery("")
    }
  }

  // 2+2 layout: each column of 4 seats arranged top-window, top-aisle, [aisle gap], bottom-aisle, bottom-window
  const cols: {
    topWindow: SeatInfo | null
    topAisle: SeatInfo | null
    bottomAisle: SeatInfo | null
    bottomWindow: SeatInfo | null
  }[] = []
  for (let i = 0; i < capacity; i += 4) {
    cols.push({
      topWindow: sortedSeats[i + 3] ?? null,
      topAisle: sortedSeats[i + 2] ?? null,
      bottomAisle: sortedSeats[i + 1] ?? null,
      bottomWindow: sortedSeats[i] ?? null,
    })
  }

  const renderSeat = (seat: SeatInfo | null) => {
    if (!seat) return <div className="h-[4.5rem] w-28" />
    const isSelected = selectedSeats.includes(seat.seatNumber) || !!seat.isSelected
    const highlight: "match" | "current" | null =
      seat.seatNumber === currentMatchSeatNumber
        ? "current"
        : matchSet.has(seat.seatNumber)
          ? "match"
          : null
    const groupId = seat.reservation?.groupId
    const groupLabel = groupId ? groupLabelByGroupId?.get(groupId) ?? null : null
    return (
      <Seat
        key={seat.seatNumber}
        seat={seat}
        isSelected={isSelected}
        onClick={() => onSeatClick(seat.seatNumber, seat.reservation)}
        allowMultiSelect={allowMultiSelect}
        highlight={highlight}
        groupLabel={groupLabel}
      />
    )
  }

  const hasReservations = reservedSeatsWithIndex.length > 0
  const hasQuery = query.trim().length > 0

  return (
    <div className="w-full min-w-0 space-y-3">
      {/* Quick passenger search */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-0 flex-1 sm:max-w-md">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <Input
            ref={inputRef}
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleSearchKeyDown}
            placeholder="Pretraži putnike po imenu ili telefonu…"
            disabled={!hasReservations}
            aria-label="Pretraga putnika u vožnji"
            className="pl-9 pr-9"
          />
          {hasQuery && (
            <button
              type="button"
              onClick={() => {
                setQuery("")
                inputRef.current?.focus()
              }}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded-sm p-1 text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              aria-label="Obriši pretragu"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {hasQuery && (
          <div
            role="status"
            aria-live="polite"
            className={cn(
              "flex items-center gap-1.5 text-xs font-medium",
              matches.length === 0 ? "text-muted-foreground" : "text-foreground",
            )}
          >
            {matches.length === 0 ? (
              <span>Bez pogodaka</span>
            ) : (
              <>
                <span className="tabular-nums">
                  {currentMatchIndex + 1} / {matches.length}
                </span>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => cycleMatch(-1)}
                  aria-label="Prethodni pogodak"
                  disabled={matches.length <= 1}
                >
                  <ArrowUp className="h-3.5 w-3.5" />
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => cycleMatch(1)}
                  aria-label="Sledeći pogodak"
                  disabled={matches.length <= 1}
                >
                  <ArrowDown className="h-3.5 w-3.5" />
                </Button>
              </>
            )}
          </div>
        )}
      </div>

      <div
        ref={gridRef}
        className="w-full overflow-x-auto rounded-2xl border-2 border-dashed border-muted-foreground/30 bg-muted/30 p-4 sm:p-6"
      >
        <div className="flex w-max items-stretch gap-3">
          {/* Driver / front-of-bus indicator */}
          <div
            className="flex w-14 shrink-0 flex-col items-center justify-between gap-2 rounded-lg border bg-background/60 py-3 text-[10px] font-bold uppercase tracking-wider text-muted-foreground"
            aria-hidden="true"
          >
            <span className="rotate-180 [writing-mode:vertical-rl]">Napred</span>
            <SteeringWheelIcon className="h-6 w-6" />
            <span className="rotate-180 text-[9px] font-medium [writing-mode:vertical-rl]">
              Vozač
            </span>
          </div>

          {/* Seat grid */}
          <div className="relative flex gap-2 rounded-lg bg-background/40 px-2 py-2">
            {cols.map((col, columnIndex) => (
              <div key={columnIndex} className="flex flex-col items-center gap-1.5">
                {renderSeat(col.topWindow)}
                {renderSeat(col.topAisle)}
                <div className="flex h-3 items-center">
                  <span className="h-px w-full border-t border-dashed border-muted-foreground/40" />
                </div>
                {renderSeat(col.bottomAisle)}
                {renderSeat(col.bottomWindow)}
              </div>
            ))}
          </div>
        </div>

        <p className="mt-3 text-center text-[11px] uppercase tracking-wide text-muted-foreground">
          Prolaz označen isprekidanom linijom · Raspored 2 + 2
        </p>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
        <LegendItem variant="available" label="Slobodno" />
        <LegendItem variant="reserved" label="Rezervisano" />
        {allowMultiSelect && <LegendItem variant="selected" label="Izabrano" />}
      </div>
    </div>
  )
}

function LegendItem({
  variant,
  label,
}: {
  variant: "available" | "reserved" | "selected"
  label: string
}) {
  return (
    <div className="flex items-center gap-2">
      <div
        className={cn(
          "h-4 w-4 shrink-0 rounded border-2",
          getSeatClasses(variant, false),
        )}
      />
      <span>{label}</span>
    </div>
  )
}

function SteeringWheelIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="12" r="2" />
      <path d="M12 14v7" />
      <path d="M10 13l-7 4" />
      <path d="M14 13l7 4" />
    </svg>
  )
}
