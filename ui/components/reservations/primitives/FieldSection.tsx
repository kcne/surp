import type { LucideIcon } from "lucide-react"
import { cn } from "@/lib/utils"

interface FieldSectionProps {
  icon?: LucideIcon
  title: string
  description?: string
  /** Optional element (chip, link) shown to the right of the title row. */
  trailing?: React.ReactNode
  children: React.ReactNode
  className?: string
}

export function FieldSection({
  icon: Icon,
  title,
  description,
  trailing,
  children,
  className,
}: FieldSectionProps) {
  return (
    <section
      className={cn(
        "rounded-lg border bg-card p-4 shadow-sm",
        className,
      )}
    >
      <header className="mb-3 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="flex items-center gap-1.5 text-sm font-semibold">
            {Icon && <Icon className="h-4 w-4 text-primary" aria-hidden="true" />}
            {title}
          </h3>
          {description && (
            <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
          )}
        </div>
        {trailing && <div className="shrink-0">{trailing}</div>}
      </header>
      <div className="space-y-3">{children}</div>
    </section>
  )
}
