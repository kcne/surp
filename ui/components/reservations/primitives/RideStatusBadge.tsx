import { Ban, CalendarClock, CheckCircle2, History } from "lucide-react"
import { cn } from "@/lib/utils"
import type { RideStatus } from "@/types"

export type RideDisplayStatus = "scheduled" | "past" | "completed" | "cancelled"

export function deriveRideDisplayStatus(
  status: RideStatus,
  rideDate: string | Date | undefined,
): RideDisplayStatus {
  if (status === "cancelled") return "cancelled"
  if (status === "completed") return "completed"
  if (!rideDate) return "scheduled"

  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const candidate =
    typeof rideDate === "string" ? new Date(`${rideDate}T00:00:00`) : new Date(rideDate)
  candidate.setHours(0, 0, 0, 0)

  return candidate < today ? "past" : "scheduled"
}

const labels: Record<RideDisplayStatus, string> = {
  scheduled: "Zakazana",
  past: "Prošla",
  completed: "Završena",
  cancelled: "Otkazana",
}

const styles: Record<RideDisplayStatus, string> = {
  scheduled: "bg-success/10 text-success border-success/30",
  past: "bg-muted text-muted-foreground border-border",
  completed: "bg-muted text-muted-foreground border-border",
  cancelled: "bg-danger/10 text-danger border-danger/30",
}

const icons: Record<RideDisplayStatus, React.ComponentType<{ className?: string }>> = {
  scheduled: CalendarClock,
  past: History,
  completed: CheckCircle2,
  cancelled: Ban,
}

interface RideStatusBadgeProps {
  status: RideStatus
  rideDate?: string | Date
  size?: "sm" | "md"
  className?: string
}

export function RideStatusBadge({
  status,
  rideDate,
  size = "md",
  className,
}: RideStatusBadgeProps) {
  const display = deriveRideDisplayStatus(status, rideDate)
  const Icon = icons[display]

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border font-semibold",
        size === "sm" ? "px-2 py-0.5 text-[10px]" : "px-2.5 py-0.5 text-xs",
        styles[display],
        className,
      )}
    >
      <Icon className={size === "sm" ? "h-3 w-3" : "h-3.5 w-3.5"} />
      {labels[display]}
    </span>
  )
}
