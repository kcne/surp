"use client"

import { useMemo } from "react"
import { DataTable } from "@/components/ui/data-table"
import { getLinesTableColumns } from "@/components/lines/LinesTableColumns"
import type { Line } from "@/types"

interface LinesDataTableProps {
  lines: Line[]
  onEdit: (line: Line) => void
  onDelete: (line: Line) => void
}

/**
 * A BOTH pair is two line rows, shown as one "Dvosmerna linija" row. The row
 * carries the outbound direction, so the return direction has no row of its own
 * and needs to be reachable through an explicit action — otherwise its stations
 * can never be corrected from this screen.
 */
function groupLines(lines: Line[]): {
  rows: Line[]
  returnLineByPairKey: Map<string, Line>
} {
  const grouped = new Map<string, Line>()
  const returnLineByPairKey = new Map<string, Line>()

  lines.forEach((line) => {
    if (line.directionMode === "both" && line.pairKey) {
      const existing = grouped.get(line.pairKey)
      if (!existing || line.direction === "outbound") {
        grouped.set(line.pairKey, line)
      }

      if (line.direction === "return") {
        returnLineByPairKey.set(line.pairKey, line)
      }
      return
    }

    grouped.set(line.id, line)
  })

  // The displayed row is the outbound one, so anything it replaced is the
  // opposite direction even when the direction flag is missing.
  grouped.forEach((row, key) => {
    if (row.directionMode !== "both" || !row.pairKey) {
      return
    }

    if (!returnLineByPairKey.has(key)) {
      const opposite = lines.find(
        (line) => line.pairKey === key && line.id !== row.id
      )
      if (opposite) {
        returnLineByPairKey.set(key, opposite)
      }
    }
  })

  return { rows: Array.from(grouped.values()), returnLineByPairKey }
}

export function LinesDataTable({
  lines,
  onEdit,
  onDelete,
}: LinesDataTableProps) {
  const { rows, returnLineByPairKey } = useMemo(() => groupLines(lines), [lines])

  const columns = useMemo(
    () =>
      getLinesTableColumns({
        onEdit,
        onDelete,
        getReturnLine: (line) =>
          line.pairKey ? returnLineByPairKey.get(line.pairKey) : undefined,
      }),
    [onEdit, onDelete, returnLineByPairKey]
  )

  return (
    <DataTable
      columns={columns}
      data={rows}
      noResultsText="Nema linija"
      searchColumn="name"
      searchPlaceholder="Pretraži linije..."
    />
  )
}
