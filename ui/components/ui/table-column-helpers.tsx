"use client"

import type { ColumnDef } from "@tanstack/react-table"
import { Button } from "@/components/ui/button"
import { Pencil, Settings2, Trash2 } from "lucide-react"

export interface RowActionHandlers<TData> {
  onEdit: (row: TData) => void
  onDelete: (row: TData) => void
}

interface CreateActionColumnOptions<TData> extends RowActionHandlers<TData> {
  headerLabel?: string
}

export function createActionsColumn<TData>({
  onEdit,
  onDelete,
  headerLabel = "Akcije",
}: CreateActionColumnOptions<TData>): ColumnDef<TData> {
  return {
    id: "actions",
    header: () => (
      <div className="inline-flex items-center justify-end gap-1 text-right">
        <Settings2 className="h-4 w-4 text-muted-foreground" />
        {headerLabel}
      </div>
    ),
    cell: ({ row }) => {
      const value = row.original

      return (
        <div className="flex items-center justify-end gap-2">
          <Button variant="ghost" size="icon" onClick={() => onEdit(value)}>
            <Pencil className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => onDelete(value)}
            className="text-danger hover:text-danger hover:bg-danger/10"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      )
    },
  }
}
