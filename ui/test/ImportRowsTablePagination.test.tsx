import { afterEach, describe, expect, it, vi } from "vitest"
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react"
import { ImportRowsTable } from "@/components/reservations/import/ImportRowsTable"
import { TooltipProvider } from "@/components/ui/tooltip"
import type { ImportRowState } from "@/lib/csv-import"

function row(lineNumber: number, overrides: Partial<ImportRowState> = {}): ImportRowState {
  return {
    id: `row-${lineNumber}`,
    groupKey: `row-${lineNumber}`,
    leg: "outbound",
    source: {
      lineNumber,
      externalId: "",
      name: `Putnik ${lineNumber}`,
      departure: "Novi Sad",
      arrival: "Beograd",
      travelDate: "05.10.2026",
      phone: "0601234567",
    },
    firstName: "Putnik",
    lastName: String(lineNumber),
    phone: "+381601234567",
    passengerId: null,
    travelDate: "2026-10-05",
    departureStationId: null,
    arrivalStationId: null,
    departureMatch: "none",
    arrivalMatch: "none",
    rideInstanceId: null,
    rideInstanceCandidateIds: [],
    seatNumber: null,
    seatIsAutoAssigned: false,
    notes: "",
    excluded: false,
    duplicateResolution: null,
    issues: [],
    isValid: true,
    duplicate: null,
    ...overrides,
  }
}

// 120 rows at 25 per page is 5 pages; every tenth row has an error, 12 in all.
const rows = Array.from({ length: 120 }, (_, index) =>
  row(index + 1, (index + 1) % 10 === 0 ? { isValid: false } : {})
)

function renderTable(tableRows: ImportRowState[]) {
  const props = {
    stations: [],
    rideInstancesById: {},
    onUpdateRow: vi.fn(),
    onRemoveRow: vi.fn(),
    onToggleExcluded: vi.fn(),
    onApplyStationToAllMatching: vi.fn(),
  }
  const view = render(
    <TooltipProvider>
      <ImportRowsTable rows={tableRows} {...props} />
    </TooltipProvider>
  )

  return {
    rerender: (nextRows: ImportRowState[]) =>
      view.rerender(
        <TooltipProvider>
          <ImportRowsTable rows={nextRows} {...props} />
        </TooltipProvider>
      ),
  }
}

function goToLastPage() {
  fireEvent.click(screen.getByRole("button", { name: "Idi na stranu 5" }))
  expect(screen.getByText("Strana 5 od 5")).toBeTruthy()
}

describe("import table pagination", () => {
  afterEach(() => {
    cleanup()
  })

  it("goes back to the first page when a filter shrinks the table", () => {
    renderTable(rows)
    goToLastPage()

    fireEvent.click(screen.getByRole("button", { name: /^Greske/ }))

    expect(screen.getByText("Strana 1 od 1")).toBeTruthy()
    expect(screen.getByText("Prikazano 12 od 12 redova")).toBeTruthy()
  })

  it("goes back to the first page when a search shrinks the table", () => {
    renderTable(rows)
    goToLastPage()

    fireEvent.change(screen.getByPlaceholderText("Pretrazi putnika ili stanicu..."), {
      target: { value: "Putnik 11" },
    })

    // Putnik 11 and 110-119.
    expect(screen.getByText("Strana 1 od 1")).toBeTruthy()
    expect(screen.getByText("Prikazano 11 od 11 redova")).toBeTruthy()
  })

  it("never leaves the operator past the end when rows are removed", async () => {
    const { rerender } = renderTable(rows)
    // TanStack arms its page-index reset in a microtask after the first render;
    // a browser runs it long before the operator can touch the table.
    await act(async () => {})
    goToLastPage()

    rerender(rows.slice(0, 40))

    // The reset itself also lands in a microtask after the rows change.
    expect(await screen.findByText("Strana 1 od 2")).toBeTruthy()
    expect(screen.getByText("Prikazano 25 od 40 redova")).toBeTruthy()
  })
})
