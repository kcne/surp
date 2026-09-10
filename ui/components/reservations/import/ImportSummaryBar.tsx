"use client"

import {
  AlertTriangle,
  CheckCircle2,
  CircleSlash,
  Copy,
  Loader2,
  XCircle,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { cn } from "@/lib/utils"

export interface ImportSummary {
  total: number
  included: number
  excluded: number
  valid: number
  invalid: number
  withWarnings: number
  duplicates: number
  canSubmit: boolean
}

interface ImportSummaryBarProps {
  summary: ImportSummary
  isResolving: boolean
  isCommitting: boolean
  onSubmit: () => void
  onReset: () => void
}

interface StatProps {
  icon: React.ComponentType<{ className?: string }>
  label: string
  value: number
  tone: "success" | "danger" | "warning" | "muted"
}

const TONE_CLASSES: Record<StatProps["tone"], string> = {
  success: "text-emerald-600",
  danger: "text-destructive",
  warning: "text-amber-600",
  muted: "text-muted-foreground",
}

function Stat({ icon: Icon, label, value, tone }: StatProps) {
  return (
    <div className="flex items-center gap-2">
      <Icon className={cn("h-4 w-4", TONE_CLASSES[tone])} />
      <span className="text-sm">
        <span className="font-semibold">{value}</span>{" "}
        <span className="text-muted-foreground">{label}</span>
      </span>
    </div>
  )
}

export function ImportSummaryBar({
  summary,
  isResolving,
  isCommitting,
  onSubmit,
  onReset,
}: ImportSummaryBarProps) {
  return (
    <Card>
      <CardContent className="flex flex-col gap-4 p-4 md:flex-row md:items-center md:justify-between">
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
          <Stat icon={CheckCircle2} label="spremno" value={summary.valid} tone="success" />
          <Stat icon={XCircle} label="sa greskom" value={summary.invalid} tone="danger" />
          <Stat
            icon={AlertTriangle}
            label="za proveru"
            value={summary.withWarnings}
            tone="warning"
          />
          <Stat icon={CircleSlash} label="izuzeto" value={summary.excluded} tone="muted" />
          {summary.duplicates > 0 ? (
            <Stat
              icon={Copy}
              label="duplikata"
              value={summary.duplicates}
              tone="muted"
            />
          ) : null}
        </div>

        <div className="flex items-center gap-2">
          {isResolving ? (
            <span className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Povezivanje sa voznjama...
            </span>
          ) : null}

          <Button type="button" variant="ghost" onClick={onReset} disabled={isCommitting}>
            Ponisti
          </Button>

          <Button
            type="button"
            onClick={onSubmit}
            disabled={!summary.canSubmit || isCommitting || isResolving}
          >
            {isCommitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Uvozim...
              </>
            ) : (
              `Uvezi ${summary.valid} rezervacija`
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
