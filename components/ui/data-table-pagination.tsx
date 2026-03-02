"use client"

import {
  Table,
} from "@tanstack/react-table"
import { Button } from "@/components/ui/button"
import { Hash, ListOrdered } from "lucide-react"

interface DataTablePaginationProps<TData> {
  table: Table<TData>
}

export function DataTablePagination<TData>({
  table,
}: DataTablePaginationProps<TData>) {
  const pageCount = Math.max(table.getPageCount(), 1)
  const currentPage = table.getState().pagination.pageIndex

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="text-sm text-muted-foreground">
        Prikazano {table.getRowModel().rows.length} od {table.getFilteredRowModel().rows.length} redova
      </div>

      <div className="flex items-center gap-2 sm:gap-4">
        <div className="text-sm text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <ListOrdered className="h-3.5 w-3.5" />
            Redova po strani {table.getState().pagination.pageSize}
          </span>
        </div>

        <div className="text-sm text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <Hash className="h-3.5 w-3.5" />
            Strana {currentPage + 1} od {pageCount}
          </span>
        </div>

        <div className="flex items-center gap-1">
          {Array.from({ length: pageCount }, (_, index) => {
            const isActive = index === currentPage

            return (
              <Button
                key={index}
                variant={isActive ? "default" : "outline"}
                size="sm"
                onClick={() => table.setPageIndex(index)}
                className="min-w-8 px-2"
                aria-label={`Idi na stranu ${index + 1}`}
              >
                {index + 1}
              </Button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
