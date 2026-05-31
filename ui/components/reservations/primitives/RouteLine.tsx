import { Fragment } from "react"
import { cn } from "@/lib/utils"

interface RouteLineProps {
  from: string
  to: string
  /** Number of intermediate stops (renders that many small dots). */
  intermediateStops?: number
  /** Optional duration label rendered under the line (e.g. "5h 30m"). */
  durationLabel?: string | null
  className?: string
  /** Visual size: "md" (cards) or "sm" (dense rows / modal headers). */
  size?: "sm" | "md"
}

export function RouteLine({
  from,
  to,
  intermediateStops = 0,
  durationLabel,
  className,
  size = "md",
}: RouteLineProps) {
  const stops = Math.max(intermediateStops, 0)
  const cityClasses =
    size === "sm"
      ? "text-sm font-semibold"
      : "text-base font-semibold sm:text-lg"

  const stopDotClass =
    size === "sm"
      ? "h-1 w-1 shrink-0 rounded-full bg-muted-foreground/60"
      : "h-1.5 w-1.5 shrink-0 rounded-full bg-muted-foreground/60"

  const arrivalDotClass =
    size === "sm"
      ? "h-1.5 w-1.5 shrink-0 rounded-full bg-primary"
      : "h-2 w-2 shrink-0 rounded-full bg-primary"

  const departureDotClass =
    size === "sm"
      ? "h-1.5 w-1.5 shrink-0 rounded-full border border-primary bg-background"
      : "h-2 w-2 shrink-0 rounded-full border border-primary bg-background"

  const connectorWidth = size === "sm" ? "w-20" : "w-32"

  return (
    <div className={cn("flex flex-col gap-0.5", className)}>
      <div className="flex w-full items-center gap-2">
        <span className={cn("min-w-0 truncate", cityClasses)} title={from}>
          {from}
        </span>

        <div
          className={cn("flex shrink-0 items-center gap-1", connectorWidth)}
          aria-hidden="true"
        >
          <span className={departureDotClass} />
          <span className="h-px flex-1 bg-border" />
          {Array.from({ length: stops }).map((_, index) => (
            <Fragment key={index}>
              <span className={stopDotClass} />
              <span className="h-px flex-1 bg-border" />
            </Fragment>
          ))}
          <span className={arrivalDotClass} />
        </div>

        <span className={cn("min-w-0 truncate", cityClasses)} title={to}>
          {to}
        </span>
      </div>
      {(stops > 0 || durationLabel) && (
        <div className="flex items-center justify-between text-[11px] text-muted-foreground">
          {stops > 0 ? (
            <span>{stopsLabel(stops)}</span>
          ) : (
            <span aria-hidden="true" />
          )}
          {durationLabel && <span className="tabular-nums">{durationLabel}</span>}
        </div>
      )}
    </div>
  )
}

function stopsLabel(count: number): string {
  if (count === 1) return "1 stajalište"
  if (count >= 2 && count <= 4) return `${count} stajališta`
  return `${count} stajališta`
}
