"use client"

import Link from "next/link"
import { ChevronRight } from "lucide-react"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  InvariantStatusBadge,
  formatDuration,
  formatRunDate,
  invariantStatus,
} from "@/components/settings/invariant-status"
import type { InvariantSummaryItemDto } from "@/infrastructure/generated/model"

/**
 * Every check in one table.
 *
 * Ordered by what needs attention rather than by the registry: a critical check
 * with violations belongs above fifteen clean ones, and at sixteen rows the
 * alternative is scrolling to find out whether anything is wrong.
 */
const STATUS_ORDER = { critical: 0, warning: 1, unchecked: 2, clean: 3 } as const

export function InvariantSummaryTable({ items }: { items: InvariantSummaryItemDto[] }) {
  const sorted = [...items].sort((a, b) => {
    const byStatus =
      STATUS_ORDER[invariantStatus(a)] - STATUS_ORDER[invariantStatus(b)]

    return byStatus !== 0 ? byStatus : b.violationCount - a.violationCount
  })

  return (
    <div className="overflow-x-auto rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Provera</TableHead>
            <TableHead>Stanje</TableHead>
            <TableHead className="text-right">Problema</TableHead>
            <TableHead className="text-right">Provereno</TableHead>
            <TableHead>Traje</TableHead>
            <TableHead className="sr-only">Detalji</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sorted.map((item) => {
            const status = invariantStatus(item)

            return (
              <TableRow key={item.key} className="group">
                <TableCell className="font-medium">
                  <Link
                    href={`/settings/data-integrity/${encodeURIComponent(item.key)}`}
                    className="underline-offset-4 hover:underline focus-visible:underline focus-visible:outline-none"
                  >
                    {item.title}
                  </Link>
                  <div className="text-xs text-muted-foreground">{item.key}</div>
                </TableCell>
                <TableCell>
                  <InvariantStatusBadge status={status} />
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {status === "unchecked" ? (
                    <span className="text-muted-foreground">&mdash;</span>
                  ) : (
                    item.violationCount
                  )}
                </TableCell>
                <TableCell className="text-right tabular-nums text-muted-foreground">
                  {status === "unchecked" ? <span>&mdash;</span> : item.scannedCount}
                </TableCell>
                <TableCell className="whitespace-nowrap text-muted-foreground">
                  {item.failingSince ? (
                    <span title={`Od ${formatRunDate(item.failingSince)}`}>
                      {item.failingSinceIsLowerBound ? "najmanje " : ""}
                      {formatDuration(item.failingSince)}
                    </span>
                  ) : (
                    <span>&mdash;</span>
                  )}
                </TableCell>
                <TableCell className="w-10 text-right" aria-hidden="true">
                  <ChevronRight className="ml-auto h-4 w-4 text-muted-foreground" />
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
    </div>
  )
}
