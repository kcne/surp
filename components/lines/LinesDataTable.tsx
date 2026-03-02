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

function groupLines(lines: Line[]): Line[] {
  const grouped = new Map<string, Line>()

  lines.forEach((line) => {
    if (line.directionMode === "both" && line.pairKey) {
      const existing = grouped.get(line.pairKey)
      if (!existing || line.direction === "outbound") {
        grouped.set(line.pairKey, line)
      }
      return
    }

    grouped.set(line.id, line)
  })

  return Array.from(grouped.values())
}

export function LinesDataTable({
  lines,
  onEdit,
  onDelete,
}: LinesDataTableProps) {
  const groupedLines = useMemo(() => groupLines(lines), [lines])

  const columns = useMemo(
    () => getLinesTableColumns({ onEdit, onDelete }),
    [onEdit, onDelete]
  )

  return (
    <DataTable
      columns={columns}
      data={groupedLines}
      noResultsText="Nema linija"
      searchColumn="name"
      searchPlaceholder="Pretraži linije..."
    />
  )
}
