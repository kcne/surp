import type { LucideIcon } from "lucide-react"
import { cn } from "@/lib/utils"

interface StatCardProps {
  icon: LucideIcon
  label: string
  value: React.ReactNode
  /** Optional secondary line below the value (e.g. progress bar, helper text). */
  helper?: React.ReactNode
  /** Visual emphasis tone applied to the value text. */
  tone?: "default" | "success" | "warning" | "danger" | "muted"
  className?: string
}

const toneClasses: Record<NonNullable<StatCardProps["tone"]>, string> = {
  default: "text-foreground",
  success: "text-success",
  warning: "text-warning",
  danger: "text-danger",
  muted: "text-muted-foreground",
}

export function StatCard({
  icon: Icon,
  label,
  value,
  helper,
  tone = "default",
  className,
}: StatCardProps) {
  return (
    <div
      className={cn(
        "flex min-w-0 flex-col gap-1 rounded-lg border bg-card p-3 shadow-sm",
        className,
      )}
    >
      <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        <Icon className="h-3.5 w-3.5" />
        <span className="truncate">{label}</span>
      </div>
      <div
        className={cn(
          "text-lg font-semibold leading-tight tabular-nums sm:text-xl",
          toneClasses[tone],
        )}
      >
        {value}
      </div>
      {helper && <div className="text-xs text-muted-foreground">{helper}</div>}
    </div>
  )
}
