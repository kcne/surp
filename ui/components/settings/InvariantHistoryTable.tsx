"use client"

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { formatRunMoment, triggerLabel } from "@/components/settings/invariant-status"
import type { InvariantHistoryPointDto } from "@/infrastructure/generated/model"

/**
 * Run by run, newest first.
 *
 * This is the column a postmortem starts from: a count on its own does not say
 * whether a problem arrived last night or has been standing for three weeks,
 * and that was the question #14 could not answer.
 */
export function InvariantHistoryTable({ points }: { points: InvariantHistoryPointDto[] }) {
  if (points.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Nema zapisanih provera. Istorija se popunjava nocnim proverama i svakim pokretanjem
        &quot;Proveri sve&quot;.
      </p>
    )
  }

  return (
    <div className="overflow-x-auto rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Provera</TableHead>
            <TableHead>Pokrenuto</TableHead>
            <TableHead className="text-right">Problema</TableHead>
            <TableHead className="text-right">Provereno</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {points.map((point) => (
            <TableRow key={point.runId}>
              <TableCell className="whitespace-nowrap font-medium">
                {formatRunMoment(point.checkedAt)}
              </TableCell>
              <TableCell className="text-muted-foreground">
                {triggerLabel(point.trigger)}
              </TableCell>
              <TableCell className="text-right tabular-nums">
                {point.checked ? (
                  point.violationCount
                ) : (
                  // A run older than the check itself says nothing about it, and
                  // showing a zero there would read as a clean night it never had.
                  <span className="text-muted-foreground" title="Provera tada nije postojala">
                    &mdash;
                  </span>
                )}
              </TableCell>
              <TableCell className="text-right tabular-nums text-muted-foreground">
                {point.checked ? point.scannedCount : <span>&mdash;</span>}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
