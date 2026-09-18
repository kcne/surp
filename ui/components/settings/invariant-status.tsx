import { AlertTriangle, CheckCircle2, CircleDashed, TriangleAlert } from "lucide-react"
import { cn } from "@/lib/utils"

/**
 * One line for the state of a check.
 *
 * The page carries sixteen rows, so the state has to read without counting:
 * colour and word first, numbers second. A check nobody has run yet is its own
 * state and must not look like a clean one — that distinction is the whole
 * reason a run stores what it scanned.
 */
export type InvariantStatus = "critical" | "warning" | "clean" | "unchecked"

export function invariantStatus(item: {
  checked: boolean
  violationCount: number
  severity: string
}): InvariantStatus {
  if (!item.checked) return "unchecked"
  if (item.violationCount === 0) return "clean"

  return item.severity === "critical" ? "critical" : "warning"
}

const STATUS_LABELS: Record<InvariantStatus, string> = {
  critical: "Kriticno",
  warning: "Upozorenje",
  clean: "U redu",
  unchecked: "Nije provereno",
}

const STATUS_CLASSES: Record<InvariantStatus, string> = {
  critical: "border-destructive/30 bg-destructive/10 text-destructive",
  warning: "border-amber-300 bg-amber-50 text-amber-800",
  clean: "border-emerald-200 bg-emerald-50 text-emerald-700",
  unchecked: "border-muted bg-muted text-muted-foreground",
}

const STATUS_ICONS: Record<InvariantStatus, typeof AlertTriangle> = {
  critical: TriangleAlert,
  warning: AlertTriangle,
  clean: CheckCircle2,
  unchecked: CircleDashed,
}

export function InvariantStatusBadge({
  status,
  className,
}: {
  status: InvariantStatus
  className?: string
}) {
  const Icon = STATUS_ICONS[status]

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-0.5 text-xs font-semibold",
        STATUS_CLASSES[status],
        className
      )}
    >
      <Icon className="h-3.5 w-3.5" aria-hidden="true" />
      {STATUS_LABELS[status]}
    </span>
  )
}

/** "18.09.2026. u 02:01" — the form used everywhere a run is named. */
export function formatRunMoment(value: string | undefined): string {
  if (!value) return ""

  const date = new Date(value)
  const pad = (part: number) => String(part).padStart(2, "0")

  return `${pad(date.getDate())}.${pad(date.getMonth() + 1)}.${date.getFullYear()}. u ${pad(
    date.getHours()
  )}:${pad(date.getMinutes())}`
}

/** "18.09.2026." — for a column where the time would only add width. */
export function formatRunDate(value: string | undefined): string {
  if (!value) return ""

  const date = new Date(value)
  const pad = (part: number) => String(part).padStart(2, "0")

  return `${pad(date.getDate())}.${pad(date.getMonth() + 1)}.${date.getFullYear()}.`
}

/** How long something has been standing, in the words an agency would use. */
export function formatDuration(since: string): string {
  const days = Math.max(
    0,
    Math.floor((Date.now() - new Date(since).getTime()) / (24 * 60 * 60 * 1000))
  )

  if (days === 0) return "danas"
  if (days === 1) return "1 dan"

  return `${days} dana`
}

export function triggerLabel(trigger: string): string {
  return trigger === "MANUAL" ? "rucno" : "automatski"
}
