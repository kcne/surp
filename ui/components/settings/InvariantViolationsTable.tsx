"use client"

import { Fragment, useId, useState } from "react"
import { ChevronDown, ChevronRight } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { formatDuration, formatRunDate } from "@/components/settings/invariant-status"
import type { InvariantHistoryViolationDto } from "@/infrastructure/generated/model"

/**
 * The violations of one check.
 *
 * Every check writes its own sentence per violation, in Serbian, and that same
 * sentence is what the nightly ticket and the alert email carry. The table
 * shows it rather than re-assembling one per check here: sixteen bespoke
 * renderings would be sixteen wordings to keep in step with those emails.
 *
 * The fields behind the sentence — seat numbers, station names, the departure
 * time the reservation still holds — sit one click away, which is where
 * somebody debugging a specific passenger will look.
 */
export function InvariantViolationsTable({
  violations,
}: {
  violations: InvariantHistoryViolationDto[]
}) {
  const [expanded, setExpanded] = useState<string | null>(null)
  const detailsIdPrefix = useId()

  return (
    <div className="overflow-x-auto rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-10">
              <span className="sr-only">Detalji</span>
            </TableHead>
            <TableHead>Problem</TableHead>
            <TableHead className="whitespace-nowrap">Traje</TableHead>
            <TableHead>Popravka</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {violations.map((violation, index) => {
            const rowKey = `${violation.subjectType}:${violation.subjectId}`
            const isExpanded = expanded === rowKey
            const detailsId = `${detailsIdPrefix}-details-${index}`

            return (
              <Fragment key={rowKey}>
                <TableRow>
                  <TableCell>
                    <button
                      type="button"
                      onClick={() => setExpanded(isExpanded ? null : rowKey)}
                      aria-expanded={isExpanded}
                      aria-controls={detailsId}
                      aria-label={
                        isExpanded
                          ? `Sakrij podatke problema: ${violation.summary}`
                          : `Prikazi podatke problema: ${violation.summary}`
                      }
                      className="inline-flex h-11 w-11 items-center justify-center rounded hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      {isExpanded ? (
                        <ChevronDown className="h-4 w-4" />
                      ) : (
                        <ChevronRight className="h-4 w-4" />
                      )}
                    </button>
                  </TableCell>
                  <TableCell className="font-medium">
                    {violation.summary}
                    <div className="text-xs text-muted-foreground">
                      {violation.subjectType} &middot; {violation.subjectId}
                    </div>
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-muted-foreground">
                    <span title={`Od ${formatRunDate(violation.firstSeenAt)}`}>
                      {violation.firstSeenAtIsLowerBound ? "najmanje " : ""}
                      {formatDuration(violation.firstSeenAt)}
                    </span>
                  </TableCell>
                  <TableCell>
                    {violation.canRepair ? (
                      <Badge variant="secondary">automatski</Badge>
                    ) : (
                      <Badge variant="destructive">rucno</Badge>
                    )}
                  </TableCell>
                </TableRow>

                {isExpanded ? (
                  <TableRow className="bg-muted/40 hover:bg-muted/40">
                    <TableCell />
                    <TableCell colSpan={3}>
                      <dl
                        id={detailsId}
                        role="region"
                        aria-label={`Podaci problema: ${violation.summary}`}
                        className="grid grid-cols-1 gap-x-6 gap-y-1 text-sm sm:grid-cols-2"
                      >
                        {Object.entries(violation.detail ?? {}).map(([field, value]) => (
                          <div key={field} className="flex gap-2">
                            <dt className="shrink-0 text-muted-foreground">{field}</dt>
                            <dd className="break-all font-medium">{formatValue(value)}</dd>
                          </div>
                        ))}
                      </dl>
                    </TableCell>
                  </TableRow>
                ) : null}
              </Fragment>
            )
          })}
        </TableBody>
      </Table>
    </div>
  )
}

/** Detail fields are check-specific and untyped, so every shape is printable. */
function formatValue(value: unknown): string {
  if (value === null || value === undefined) return "—"
  if (Array.isArray(value)) return value.length > 0 ? value.map(formatValue).join(", ") : "—"
  if (typeof value === "boolean") return value ? "da" : "ne"
  if (typeof value === "object") return JSON.stringify(value)

  return String(value)
}
