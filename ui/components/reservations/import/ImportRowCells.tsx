"use client"

import { useEffect, useState } from "react"
import { AlertTriangle } from "lucide-react"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"
import type { ImportIssue, ImportRowField } from "@/lib/csv-import"
import type { RideInstance } from "@/types"

export function fieldIssues(issues: ImportIssue[], field: ImportRowField) {
  const forField = issues.filter((issue) => issue.field === field)

  return {
    hasError: forField.some((issue) => issue.severity === "error"),
    hasWarning: forField.some((issue) => issue.severity === "warning"),
    messages: forField.map((issue) => issue.message),
  }
}

interface CellShellProps {
  messages: string[]
  hasError: boolean
  hasWarning: boolean
  children: React.ReactNode
}

/** Wraps a cell editor with its validation messaging. */
export function CellShell({ messages, hasError, hasWarning, children }: CellShellProps) {
  if (messages.length === 0) {
    return <>{children}</>
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div className="space-y-1">
          {children}
          <p
            className={cn(
              "flex items-center gap-1 truncate text-[11px] leading-tight",
              hasError ? "text-destructive" : hasWarning ? "text-amber-600" : "text-muted-foreground"
            )}
          >
            <AlertTriangle className="h-3 w-3 shrink-0" />
            {messages[0]}
          </p>
        </div>
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-xs">
        <ul className="space-y-1 text-xs">
          {messages.map((message) => (
            <li key={message}>{message}</li>
          ))}
        </ul>
      </TooltipContent>
    </Tooltip>
  )
}

interface TextCellProps {
  value: string
  placeholder?: string
  invalid?: boolean
  onCommit: (value: string) => void
}

/** Local draft state so typing is not fought by the row revalidation pass. */
export function TextCell({ value, placeholder, invalid, onCommit }: TextCellProps) {
  const [draft, setDraft] = useState(value)

  useEffect(() => {
    setDraft(value)
  }, [value])

  return (
    <Input
      value={draft}
      placeholder={placeholder}
      onChange={(event) => setDraft(event.target.value)}
      onBlur={() => {
        if (draft !== value) {
          onCommit(draft)
        }
      }}
      onKeyDown={(event) => {
        if (event.key === "Enter") {
          event.currentTarget.blur()
        }
      }}
      className={cn("h-8 px-2 text-sm", invalid && "border-destructive")}
    />
  )
}

interface SeatCellProps {
  value: number | null
  isAutoAssigned: boolean
  invalid?: boolean
  onCommit: (value: number | null) => void
}

export function SeatCell({ value, isAutoAssigned, invalid, onCommit }: SeatCellProps) {
  const [draft, setDraft] = useState(value === null ? "" : String(value))

  useEffect(() => {
    setDraft(value === null ? "" : String(value))
  }, [value])

  return (
    <Input
      value={draft}
      inputMode="numeric"
      placeholder="auto"
      title={isAutoAssigned ? "Automatski dodeljeno, obrisite da ponovo dodelite" : undefined}
      onChange={(event) => setDraft(event.target.value.replace(/[^\d]/g, ""))}
      onBlur={() => {
        const next = draft.trim().length === 0 ? null : Number(draft)
        if (next !== value) {
          onCommit(next)
        }
      }}
      onKeyDown={(event) => {
        if (event.key === "Enter") {
          event.currentTarget.blur()
        }
      }}
      className={cn(
        "h-8 w-16 px-2 text-sm",
        isAutoAssigned && "text-muted-foreground",
        invalid && "border-destructive"
      )}
    />
  )
}

interface RideInstanceCellProps {
  value: string | null
  candidateIds: string[]
  rideInstancesById: Record<string, RideInstance>
  invalid?: boolean
  onChange: (rideInstanceId: string) => void
}

export function RideInstanceCell({
  value,
  candidateIds,
  rideInstancesById,
  invalid,
  onChange,
}: RideInstanceCellProps) {
  const candidates = candidateIds
    .map((id) => rideInstancesById[id])
    .filter((rideInstance): rideInstance is RideInstance => Boolean(rideInstance))

  if (candidates.length === 0) {
    return <span className="text-xs text-muted-foreground">Nema voznje</span>
  }

  return (
    <Select value={value ?? ""} onValueChange={onChange}>
      <SelectTrigger
        className={cn("h-8 px-2 text-sm", invalid && "border-destructive text-destructive")}
      >
        <SelectValue placeholder="Izaberi voznju" />
      </SelectTrigger>
      <SelectContent>
        {candidates.map((rideInstance) => (
          <SelectItem key={rideInstance.id} value={rideInstance.id}>
            {rideInstance.departureTime} · {rideInstance.ride.name}
            {typeof rideInstance.availableSeats === "number"
              ? ` · ${rideInstance.availableSeats} slob.`
              : ""}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
