import { Flame } from "lucide-react"
import { cn } from "@/lib/utils"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"

interface OccupancyMeterProps {
  reserved: number
  capacity: number
  /** When true, render the meter in a muted/disabled tone (e.g. cancelled or past rides). */
  inactive?: boolean
  /** Hide the textual "x/y" count next to the bar. */
  hideCount?: boolean
  /** Hide the "Skoro popunjeno" pill. */
  hideFillingFastBadge?: boolean
  className?: string
}

const TOOLTIP_NOTE =
  "Ukupno rezervacija na vožnji. Segmentna popunjenost po stanicama može biti veća."

export function OccupancyMeter({
  reserved,
  capacity,
  inactive = false,
  hideCount = false,
  hideFillingFastBadge = false,
  className,
}: OccupancyMeterProps) {
  const safeCapacity = Math.max(capacity, 0)
  const safeReserved = Math.max(Math.min(reserved, safeCapacity), 0)
  const ratio = safeCapacity > 0 ? safeReserved / safeCapacity : 0
  const percent = Math.round(ratio * 100)

  let toneBar = "bg-success"
  if (inactive) {
    toneBar = "bg-muted-foreground/40"
  } else if (ratio > 0.85) {
    toneBar = "bg-danger"
  } else if (ratio > 0.6) {
    toneBar = "bg-warning"
  }

  const fillingFast = !inactive && ratio >= 0.8 && ratio < 1 && safeCapacity > 0
  const isFull = !inactive && safeCapacity > 0 && safeReserved >= safeCapacity

  return (
    <div className={cn("flex flex-col gap-1", className)}>
      <div className="flex items-center gap-2">
        <TooltipProvider delayDuration={200}>
          <Tooltip>
            <TooltipTrigger asChild>
              <div
                role="progressbar"
                aria-valuenow={safeReserved}
                aria-valuemin={0}
                aria-valuemax={safeCapacity}
                aria-label={`Popunjenost ${safeReserved} od ${safeCapacity}`}
                className="h-1.5 w-full min-w-[80px] overflow-hidden rounded-full bg-muted"
              >
                <div
                  className={cn("h-full rounded-full transition-all", toneBar)}
                  style={{ width: `${Math.min(percent, 100)}%` }}
                />
              </div>
            </TooltipTrigger>
            <TooltipContent side="top" className="max-w-[260px] text-xs">
              {TOOLTIP_NOTE}
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>

        {!hideCount && (
          <span
            className={cn(
              "shrink-0 text-xs font-semibold tabular-nums",
              inactive ? "text-muted-foreground" : "text-foreground",
            )}
          >
            {safeReserved}/{safeCapacity}
          </span>
        )}
      </div>

      {!hideFillingFastBadge && (fillingFast || isFull) && (
        <span
          className={cn(
            "inline-flex w-fit items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold",
            isFull
              ? "border-danger/30 bg-danger/10 text-danger"
              : "border-warning/30 bg-warning/10 text-warning",
          )}
        >
          <Flame className="h-3 w-3" />
          {isFull ? "Popunjeno" : "Skoro popunjeno"}
        </span>
      )}
    </div>
  )
}
