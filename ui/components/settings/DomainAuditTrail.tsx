"use client"

import { History, Loader2 } from "lucide-react"
import { useDomainAuditQuery } from "@/infrastructure/hooks/queries/useDomainAuditQuery"
import type { InvariantHistoryViolationDto } from "@/infrastructure/generated/model/invariantHistoryViolationDto"

const entityFor = (violation: InvariantHistoryViolationDto) => {
  switch (violation.subjectType) {
    case "reservation":
      return "Reservation"
    case "line":
      return "Line"
    case "ride":
      return "Ride"
    case "ride-schedule":
      return "RideDaySchedule"
    default:
      return ""
  }
}

/** The narrow change history that makes a violation actionable in a postmortem. */
export function DomainAuditTrail({ violation }: { violation: InvariantHistoryViolationDto }) {
  const entityType = entityFor(violation)
  const history = useDomainAuditQuery(entityType, violation.subjectId)

  if (!entityType) return null

  return (
    <section className="mt-4 border-t pt-3" aria-label="Istorija izmena">
      <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold">
        <History className="h-4 w-4" /> Istorija izmena (90 dana)
      </h3>
      {history.isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
      {history.isError ? (
        <p className="text-sm text-muted-foreground">Istorija izmena nije dostupna.</p>
      ) : null}
      {history.data?.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nema zabelezenih izmena za ovu stavku.</p>
      ) : null}
      {history.data?.map((event) => (
        <div key={`${event.createdAt}-${event.actorUserId}`} className="mb-3 text-sm">
          <p className="font-medium">
            {actionLabel(event.action)} · {new Date(event.createdAt).toLocaleString("sr-RS")}
          </p>
          <p className="text-muted-foreground">Korisnik: {event.actorUserId}</p>
          {Object.entries(event.changes).map(([field, value]) => (
            <p key={field} className="break-all text-muted-foreground">
              {field}: {formatChange(value)}
            </p>
          ))}
        </div>
      ))}
    </section>
  )
}

function actionLabel(action: string) {
  return action === "create" ? "dodato" : action === "delete" ? "obrisano" : "izmenjeno"
}

function formatChange(value: unknown): string {
  if (!value || typeof value !== "object" || Array.isArray(value)) return String(value ?? "—")
  const change = value as { before?: unknown; after?: unknown }
  return `${formatValue(change.before)} → ${formatValue(change.after)}`
}

function formatValue(value: unknown): string {
  if (value === null || value === undefined) return "—"
  return typeof value === "object" ? JSON.stringify(value) : String(value)
}
