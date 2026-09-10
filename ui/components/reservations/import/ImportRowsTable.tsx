"use client"

import { useMemo, useState } from "react"
import {
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  useReactTable,
  type ColumnDef,
} from "@tanstack/react-table"
import { CircleSlash, Copy, RotateCcw, Search, Trash2, Undo2, Wand2 } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { DataTablePagination } from "@/components/ui/data-table-pagination"
import { Input } from "@/components/ui/input"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"
import { normalizeKey } from "@/lib/csv-import"
import {
  CellShell,
  DateCell,
  RideInstanceCell,
  SeatCell,
  TextCell,
  fieldIssues,
} from "./ImportRowCells"
import { StationCombobox } from "./StationCombobox"
import type { StationListItem } from "@/infrastructure/hooks/queries/useStationsListQuery"
import type { ImportRow, ImportRowState } from "@/lib/csv-import"
import type { RideInstance } from "@/types"

export type RowFilter = "all" | "errors" | "warnings" | "duplicates" | "excluded"

const ROW_FILTER_LABELS: Record<RowFilter, string> = {
  all: "Svi",
  errors: "Greske",
  warnings: "Za proveru",
  duplicates: "Duplikati",
  excluded: "Izuzeti",
}

interface ImportRowsTableProps {
  rows: ImportRowState[]
  stations: StationListItem[]
  rideInstancesById: Record<string, RideInstance>
  onUpdateRow: (rowId: string, patch: Partial<ImportRow>) => void
  onRemoveRow: (rowId: string) => void
  onToggleExcluded: (rowId: string) => void
  onApplyStationToAllMatching: (rawStation: string, stationId: string) => void
}

function matchesFilter(row: ImportRowState, filter: RowFilter): boolean {
  switch (filter) {
    case "errors":
      return !row.excluded && !row.isValid
    case "warnings":
      return !row.excluded && row.isValid && row.issues.length > 0
    case "duplicates":
      return row.duplicate !== null
    case "excluded":
      return row.excluded
    case "all":
    default:
      return true
  }
}

function matchesSearch(row: ImportRowState, search: string): boolean {
  if (search.length === 0) {
    return true
  }

  const haystack = normalizeKey(
    [
      row.firstName,
      row.lastName,
      row.phone,
      row.source.name,
      row.source.departure,
      row.source.arrival,
      row.source.externalId,
    ].join(" ")
  )

  return haystack.includes(normalizeKey(search))
}

export function ImportRowsTable({
  rows,
  stations,
  rideInstancesById,
  onUpdateRow,
  onRemoveRow,
  onToggleExcluded,
  onApplyStationToAllMatching,
}: ImportRowsTableProps) {
  const [filter, setFilter] = useState<RowFilter>("all")
  const [search, setSearch] = useState("")

  const filteredRows = useMemo(
    () => rows.filter((row) => matchesFilter(row, filter) && matchesSearch(row, search)),
    [rows, filter, search]
  )

  /**
   * How many rows share a raw station spelling, for the bulk-apply action.
   * Counted once per row: a row whose departure and arrival read the same is
   * still one row, and bulk-apply would touch it once.
   */
  const rowCountByRawStation = useMemo(() => {
    const counts = new Map<string, number>()

    rows.forEach((row) => {
      const spellings = new Set(
        [row.source.departure, row.source.arrival]
          .map((raw) => raw.trim())
          .filter((raw) => raw.length > 0)
      )

      spellings.forEach((key) => {
        counts.set(key, (counts.get(key) ?? 0) + 1)
      })
    })

    return counts
  }, [rows])

  const columns = useMemo<ColumnDef<ImportRowState>[]>(() => {
    const stationColumn = (
      field: "departureStationId" | "arrivalStationId",
      sourceField: "departure" | "arrival",
      header: string
    ): ColumnDef<ImportRowState> => ({
      id: field,
      header,
      cell: ({ row }) => {
        const importRow = row.original
        const issues = fieldIssues(importRow.issues, field)
        const rawStation = importRow.source[sourceField].trim()
        const sharedCount = rowCountByRawStation.get(rawStation) ?? 1
        const selectedId = importRow[field]

        return (
          <div className="min-w-[190px] space-y-1">
            <CellShell {...issues}>
              <StationCombobox
                value={selectedId}
                stations={stations}
                placeholder="Izaberi stanicu"
                invalid={issues.hasError}
                onChange={(stationId) => onUpdateRow(importRow.id, { [field]: stationId })}
              />
            </CellShell>

            <div className="flex items-center gap-1">
              <span className="truncate text-[11px] text-muted-foreground" title={rawStation}>
                CSV: {rawStation || "—"}
              </span>

              {selectedId && sharedCount > 1 ? (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-5 w-5"
                      onClick={() => onApplyStationToAllMatching(rawStation, selectedId)}
                    >
                      <Wand2 className="h-3 w-3" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    Primeni na svih {sharedCount} redova sa &quot;{rawStation}&quot;
                  </TooltipContent>
                </Tooltip>
              ) : null}
            </div>
          </div>
        )
      },
    })

    return [
      {
        id: "source",
        header: "CSV",
        cell: ({ row }) => {
          const importRow = row.original

          return (
            <div className="space-y-1">
              <div className="text-xs text-muted-foreground">
                red {importRow.source.lineNumber}
                {importRow.source.externalId ? ` · #${importRow.source.externalId}` : ""}
              </div>
              <Badge variant={importRow.leg === "return" ? "secondary" : "outline"}>
                {importRow.leg === "return" ? "Povratak" : "Polazak"}
              </Badge>

              {importRow.duplicate ? (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Badge
                      variant="outline"
                      className="flex w-fit items-center gap-1 border-amber-300 text-[10px] text-amber-700"
                    >
                      <Copy className="h-3 w-3" />
                      {importRow.duplicate.kind === "existing" ? "Vec u sistemu" : "Duplikat u fajlu"}
                    </Badge>
                  </TooltipTrigger>
                  <TooltipContent side="right" className="max-w-xs">
                    {importRow.duplicate.message}
                  </TooltipContent>
                </Tooltip>
              ) : null}
            </div>
          )
        },
      },
      {
        id: "passenger",
        header: "Putnik",
        cell: ({ row }) => {
          const importRow = row.original
          const firstNameIssues = fieldIssues(importRow.issues, "firstName")
          const lastNameIssues = fieldIssues(importRow.issues, "lastName")

          return (
            <div className="min-w-[220px] space-y-1">
              <div className="flex gap-1">
                <CellShell {...firstNameIssues}>
                  <TextCell
                    value={importRow.firstName}
                    placeholder="Ime"
                    invalid={firstNameIssues.hasError}
                    onCommit={(value) => onUpdateRow(importRow.id, { firstName: value })}
                  />
                </CellShell>
                <CellShell {...lastNameIssues}>
                  <TextCell
                    value={importRow.lastName}
                    placeholder="Prezime"
                    invalid={lastNameIssues.hasError}
                    onCommit={(value) => onUpdateRow(importRow.id, { lastName: value })}
                  />
                </CellShell>
              </div>

              <div className="flex items-center gap-2">
                <span
                  className="truncate text-[11px] text-muted-foreground"
                  title={importRow.source.name}
                >
                  CSV: {importRow.source.name || "—"}
                </span>
                {importRow.passengerId ? (
                  <Badge variant="secondary" className="text-[10px]">
                    Postojeci
                  </Badge>
                ) : (
                  <Badge variant="outline" className="text-[10px]">
                    Novi
                  </Badge>
                )}
              </div>
            </div>
          )
        },
      },
      {
        id: "phone",
        header: "Telefon",
        cell: ({ row }) => {
          const importRow = row.original
          const issues = fieldIssues(importRow.issues, "phone")

          return (
            <div className="min-w-[140px]">
              <CellShell {...issues}>
                <TextCell
                  value={importRow.phone}
                  placeholder="Telefon"
                  invalid={issues.hasError}
                  onCommit={(value) => onUpdateRow(importRow.id, { phone: value })}
                />
              </CellShell>
            </div>
          )
        },
      },
      {
        id: "travelDate",
        header: "Datum",
        cell: ({ row }) => {
          const importRow = row.original
          const issues = fieldIssues(importRow.issues, "travelDate")

          return (
            <div className="min-w-[150px] space-y-1">
              <CellShell {...issues}>
                <DateCell
                  value={importRow.travelDate}
                  invalid={issues.hasError}
                  onChange={(travelDate) => onUpdateRow(importRow.id, { travelDate })}
                />
              </CellShell>

              <span className="block truncate text-[11px] text-muted-foreground">
                CSV: {importRow.source.travelDate.trim() || "—"}
              </span>
            </div>
          )
        },
      },
      stationColumn("departureStationId", "departure", "Polazna stanica"),
      stationColumn("arrivalStationId", "arrival", "Dolazna stanica"),
      {
        id: "rideInstanceId",
        header: "Voznja",
        cell: ({ row }) => {
          const importRow = row.original
          const issues = fieldIssues(importRow.issues, "rideInstanceId")

          return (
            <div className="min-w-[190px]">
              <CellShell {...issues}>
                <RideInstanceCell
                  value={importRow.rideInstanceId}
                  candidateIds={importRow.rideInstanceCandidateIds}
                  rideInstancesById={rideInstancesById}
                  invalid={issues.hasError}
                  onChange={(rideInstanceId) =>
                    onUpdateRow(importRow.id, { rideInstanceId })
                  }
                />
              </CellShell>
            </div>
          )
        },
      },
      {
        id: "seatNumber",
        header: "Sediste",
        cell: ({ row }) => {
          const importRow = row.original
          const issues = fieldIssues(importRow.issues, "seatNumber")

          return (
            <CellShell {...issues}>
              <SeatCell
                value={importRow.seatNumber}
                isAutoAssigned={importRow.seatIsAutoAssigned}
                invalid={issues.hasError}
                onCommit={(seatNumber) => onUpdateRow(importRow.id, { seatNumber })}
              />
            </CellShell>
          )
        },
      },
      {
        id: "notes",
        header: "Napomena",
        cell: ({ row }) => {
          const importRow = row.original

          return (
            <div className="min-w-[150px]">
              <TextCell
                value={importRow.notes}
                placeholder="Napomena"
                onCommit={(value) => onUpdateRow(importRow.id, { notes: value })}
              />
            </div>
          )
        },
      },
      {
        id: "actions",
        header: "",
        cell: ({ row }) => {
          const importRow = row.original

          return (
            <div className="flex items-center justify-end gap-1">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => onToggleExcluded(importRow.id)}
                  >
                    {importRow.excluded ? (
                      <Undo2 className="h-4 w-4" />
                    ) : (
                      <CircleSlash className="h-4 w-4" />
                    )}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  {importRow.excluded ? "Vrati u uvoz" : "Izuzmi iz uvoza"}
                </TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-destructive hover:text-destructive"
                    onClick={() => onRemoveRow(importRow.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Obrisi red</TooltipContent>
              </Tooltip>
            </div>
          )
        },
      },
    ]
  }, [
    onApplyStationToAllMatching,
    onRemoveRow,
    onToggleExcluded,
    onUpdateRow,
    rideInstancesById,
    rowCountByRawStation,
    stations,
  ])

  const table = useReactTable({
    data: filteredRows,
    columns,
    getRowId: (row) => row.id,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination: { pageSize: 25 } },
  })

  const filterCounts: Record<RowFilter, number> = {
    all: rows.length,
    errors: rows.filter((row) => matchesFilter(row, "errors")).length,
    warnings: rows.filter((row) => matchesFilter(row, "warnings")).length,
    duplicates: rows.filter((row) => matchesFilter(row, "duplicates")).length,
    excluded: rows.filter((row) => matchesFilter(row, "excluded")).length,
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex flex-wrap gap-1">
          {(Object.keys(ROW_FILTER_LABELS) as RowFilter[]).map((option) => (
            <Button
              key={option}
              type="button"
              size="sm"
              variant={filter === option ? "secondary" : "ghost"}
              onClick={() => {
                setFilter(option)
                table.setPageIndex(0)
              }}
            >
              {ROW_FILTER_LABELS[option]}
              <span className="ml-1.5 text-xs text-muted-foreground">
                {filterCounts[option]}
              </span>
            </Button>
          ))}
        </div>

        <div className="relative w-full md:w-72">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Pretrazi putnika ili stanicu..."
            value={search}
            onChange={(event) => {
              setSearch(event.target.value)
              table.setPageIndex(0)
            }}
            className="pl-9"
          />
        </div>
      </div>

      <div className="overflow-x-auto rounded-md border">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableHead key={header.id} className="whitespace-nowrap">
                    {header.isPlaceholder
                      ? null
                      : flexRender(header.column.columnDef.header, header.getContext())}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>

          <TableBody>
            {table.getRowModel().rows.length > 0 ? (
              table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  className={cn(
                    "align-top",
                    row.original.excluded && "opacity-50",
                    !row.original.excluded && !row.original.isValid && "bg-destructive/5"
                  )}
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id} className="py-2">
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={columns.length} className="h-24 text-center">
                  <span className="flex items-center justify-center gap-2 text-muted-foreground">
                    <RotateCcw className="h-4 w-4" />
                    Nema redova za izabrani filter.
                  </span>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <DataTablePagination table={table} pageSizeOptions={[25, 50, 100]} />
    </div>
  )
}
