"use client"

import {
  Table,
} from "@tanstack/react-table"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Hash,
  ListOrdered,
  type LucideIcon,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { getPaginationItems, PAGINATION_ELLIPSIS } from "@/utils/paginationItems"

interface DataTablePaginationProps<TData> {
  table: Table<TData>
  pageSizeOptions?: number[]
}

export function DataTablePagination<TData>({
  table,
  pageSizeOptions = [8, 16, 24],
}: DataTablePaginationProps<TData>) {
  const pageCount = Math.max(table.getPageCount(), 1)
  const currentPage = table.getState().pagination.pageIndex

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="text-sm text-muted-foreground">
        Prikazano {table.getRowModel().rows.length} od {table.getFilteredRowModel().rows.length} redova
      </div>

      <div className="flex flex-wrap items-center gap-2 sm:gap-4">
        <div className="text-sm text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <ListOrdered className="h-3.5 w-3.5" />
            Redova po strani
          </span>
        </div>

        <Select
          value={String(table.getState().pagination.pageSize)}
          onValueChange={(value) => table.setPageSize(Number(value))}
        >
          <SelectTrigger className="h-8 w-[92px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {pageSizeOptions.map((size) => (
              <SelectItem key={size} value={String(size)}>
                {size}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="text-sm text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <Hash className="h-3.5 w-3.5" />
            Strana {currentPage + 1} od {pageCount}
          </span>
        </div>

        <nav aria-label="Paginacija" className="flex items-center gap-1">
          <PageStepButton
            label="Prva strana"
            icon={ChevronsLeft}
            available={table.getCanPreviousPage()}
            onClick={() => table.firstPage()}
            className="sm:hidden"
          />
          <PageStepButton
            label="Prethodna strana"
            icon={ChevronLeft}
            available={table.getCanPreviousPage()}
            onClick={() => table.previousPage()}
          />

          <div className="hidden items-center gap-1 sm:flex">
            {getPaginationItems(currentPage, pageCount).map((item, position) => {
              if (item === PAGINATION_ELLIPSIS) {
                return (
                  <span
                    key={`ellipsis-${position}`}
                    aria-hidden="true"
                    className="min-w-8 px-1 text-center text-sm text-muted-foreground"
                  >
                    …
                  </span>
                )
              }

              const isActive = item === currentPage

              return (
                <Button
                  key={item}
                  variant={isActive ? "default" : "outline"}
                  size="sm"
                  onClick={() => table.setPageIndex(item)}
                  className="min-w-8 px-2"
                  aria-label={`Idi na stranu ${item + 1}`}
                  aria-current={isActive ? "page" : undefined}
                >
                  {item + 1}
                </Button>
              )
            })}
          </div>

          <PageStepButton
            label="Sledeca strana"
            icon={ChevronRight}
            available={table.getCanNextPage()}
            onClick={() => table.nextPage()}
          />
          <PageStepButton
            label="Poslednja strana"
            icon={ChevronsRight}
            available={table.getCanNextPage()}
            onClick={() => table.lastPage()}
            className="sm:hidden"
          />
        </nav>
      </div>
    </div>
  )
}

interface PageStepButtonProps {
  label: string
  icon: LucideIcon
  available: boolean
  onClick: () => void
  className?: string
}

/**
 * Marked aria-disabled rather than disabled: a disabled button drops keyboard
 * focus, so stepping onto the first or last page would leave the user on the
 * page body.
 */
function PageStepButton({ label, icon: Icon, available, onClick, className }: PageStepButtonProps) {
  return (
    <Button
      variant="outline"
      size="sm"
      onClick={available ? onClick : undefined}
      aria-disabled={!available}
      className={cn(
        "px-2 aria-disabled:cursor-not-allowed aria-disabled:opacity-50 aria-disabled:hover:bg-background aria-disabled:hover:text-inherit",
        className
      )}
      aria-label={label}
    >
      <Icon className="h-4 w-4" />
    </Button>
  )
}
