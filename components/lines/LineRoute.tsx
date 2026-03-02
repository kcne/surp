"use client"

import { cn } from "@/lib/utils"
import type { Line } from "@/types"
import { MapPin, Circle } from "lucide-react"

interface LineRouteProps {
  line: Line
  className?: string
  showIcons?: boolean
  compact?: boolean
}

export function LineRoute({ line, className, showIcons = true, compact = false }: LineRouteProps) {
  // Build the stations array in order: departure -> intermediate -> arrival
  const allStations = [
    {
      id: line.departureStation.id,
      name: line.departureStation.name,
      isDeparture: true,
      isArrival: false,
    },
    ...line.intermediateStations.map((station) => ({
      id: station.stationId,
      name: station.stationName,
      isDeparture: false,
      isArrival: false,
    })),
    {
      id: line.arrivalStation.id,
      name: line.arrivalStation.name,
      isDeparture: false,
      isArrival: true,
    },
  ]

  if (compact) {
    return (
      <div className={cn("flex items-center flex-wrap gap-1", className)}>
        {allStations.map((station, index) => {
          const isLast = index === allStations.length - 1
          return (
            <span key={station.id} className="flex items-center gap-1">
              {showIcons && (
                station.isDeparture ? (
                  <MapPin className="h-3.5 w-3.5 text-green-600 fill-green-600 shrink-0" />
                ) : station.isArrival ? (
                  <MapPin className="h-3.5 w-3.5 text-blue-600 fill-blue-600 shrink-0" />
                ) : (
                  <Circle className="h-2 w-2 text-gray-400 fill-gray-400 shrink-0" />
                )
              )}
              <span
                className={cn(
                  "text-sm",
                  station.isDeparture
                    ? "font-semibold text-green-700"
                    : station.isArrival
                    ? "font-semibold text-blue-700"
                    : "text-muted-foreground"
                )}
              >
                {station.name}
              </span>
              {!isLast && (
                <span className="text-muted-foreground/60 text-xs">→</span>
              )}
            </span>
          )
        })}
      </div>
    )
  }

  return (
    <div className={cn("space-y-0", className)}>
      {allStations.map((station, index) => {
        const isLast = index === allStations.length - 1

        return (
          <div key={station.id} className="flex items-center gap-3">
            {/* Vertical line and icon/bullet */}
            <div className="flex flex-col items-center w-4 relative">
              {/* Icon/bullet centered */}
              <div className="flex items-center justify-center w-4 h-4 relative z-10">
                {showIcons ? (
                  station.isDeparture ? (
                    <MapPin className="h-4 w-4 text-green-600 fill-green-600 -mt-0.5" />
                  ) : station.isArrival ? (
                    <MapPin className="h-4 w-4 text-blue-600 fill-blue-600 -mt-0.5" />
                  ) : (
                    <Circle className="h-2.5 w-2.5 text-gray-400 fill-gray-400" />
                  )
                ) : (
                  <Circle className="h-2.5 w-2.5 text-gray-400 fill-gray-400" />
                )}
              </div>
              {/* Vertical line centered - starts at same position for all */}
              {!isLast && (
                <div className="absolute left-1/2 -translate-x-1/2 top-4 w-px h-full min-h-[24px] bg-gray-300" />
              )}
            </div>

            {/* Station name */}
            <div className="flex-1 py-2">
              <p
                className={cn(
                  "text-sm",
                  station.isDeparture
                    ? "font-semibold text-green-700"
                    : station.isArrival
                    ? "font-semibold text-blue-700"
                    : "text-muted-foreground"
                )}
              >
                {station.name}
              </p>
            </div>
          </div>
        )
      })}
    </div>
  )
}

