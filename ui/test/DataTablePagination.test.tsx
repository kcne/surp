import { afterEach, describe, expect, it } from "vitest"
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react"
import type { ColumnDef } from "@tanstack/react-table"
import { DataTable } from "@/components/ui/data-table"

interface Row {
  name: string
}

const columns: ColumnDef<Row>[] = [{ accessorKey: "name", header: "Ime" }]
const rows = Array.from({ length: 42 * 8 }, (_, index) => ({ name: `Putnik ${index + 1}` }))

function stepButton(name: string) {
  return screen.getByRole("button", { name })
}

function pageButtons() {
  return screen.queryAllByRole("button", { name: /^Idi na stranu/ }).map((button) => button.textContent)
}

describe("data table pagination", () => {
  afterEach(() => {
    cleanup()
  })

  it("draws a window of page buttons instead of one per page", () => {
    render(<DataTable columns={columns} data={rows} />)

    expect(pageButtons()).toEqual(["1", "2", "3", "4", "5", "6", "7", "42"])
    expect(screen.getByText("Strana 1 od 42")).toBeTruthy()
    expect(screen.getByRole("button", { name: "Idi na stranu 1" }).getAttribute("aria-current")).toBe("page")
    expect(screen.getByRole("navigation", { name: "Paginacija" })).toBeTruthy()
  })

  it("hides the gap from screen readers", () => {
    render(<DataTable columns={columns} data={rows} />)

    const gap = screen.getByText("…")
    expect(gap.getAttribute("aria-hidden")).toBe("true")
  })

  it("moves the window with the next and previous buttons", () => {
    render(<DataTable columns={columns} data={rows} />)
    const previous = stepButton("Prethodna strana")
    const next = stepButton("Sledeca strana")

    expect(previous.getAttribute("aria-disabled")).toBe("true")

    fireEvent.click(screen.getByRole("button", { name: "Idi na stranu 7" }))
    fireEvent.click(next)

    expect(screen.getByText("Strana 8 od 42")).toBeTruthy()
    expect(screen.getByText("Putnik 57")).toBeTruthy()
    expect(pageButtons()).toEqual(["1", "6", "7", "8", "9", "10", "42"])

    fireEvent.click(previous)
    expect(screen.getByText("Strana 7 od 42")).toBeTruthy()
  })

  it("marks next unavailable on the last page", () => {
    render(<DataTable columns={columns} data={rows} />)

    fireEvent.click(screen.getByRole("button", { name: "Idi na stranu 42" }))

    expect(stepButton("Sledeca strana").getAttribute("aria-disabled")).toBe("true")
    expect(screen.getByText("Putnik 336")).toBeTruthy()
    expect(pageButtons()).toEqual(["1", "36", "37", "38", "39", "40", "41", "42"])
  })

  it("keeps keyboard focus on next when it reaches the last page", () => {
    render(<DataTable columns={columns} data={rows} />)
    fireEvent.click(screen.getByRole("button", { name: "Idi na stranu 42" }))
    fireEvent.click(screen.getByRole("button", { name: "Idi na stranu 41" }))

    const next = stepButton("Sledeca strana")
    next.focus()
    fireEvent.click(next)

    expect(screen.getByText("Strana 42 od 42")).toBeTruthy()
    expect(document.activeElement).toBe(next)
    expect(next.hasAttribute("disabled")).toBe(false)

    fireEvent.click(next)
    expect(screen.getByText("Strana 42 od 42")).toBeTruthy()
  })

  it("does nothing when previous is pressed on the first page", () => {
    render(<DataTable columns={columns} data={rows} />)

    fireEvent.click(stepButton("Prethodna strana"))
    fireEvent.click(stepButton("Prva strana"))

    expect(screen.getByText("Strana 1 od 42")).toBeTruthy()
    expect(screen.getByText("Putnik 1")).toBeTruthy()
  })

  it("jumps to the first and last page without the page buttons", () => {
    render(<DataTable columns={columns} data={rows} />)

    fireEvent.click(stepButton("Poslednja strana"))
    expect(screen.getByText("Strana 42 od 42")).toBeTruthy()
    expect(stepButton("Poslednja strana").getAttribute("aria-disabled")).toBe("true")
    expect(stepButton("Prva strana").getAttribute("aria-disabled")).toBe("false")

    fireEvent.click(stepButton("Prva strana"))
    expect(screen.getByText("Strana 1 od 42")).toBeTruthy()
    expect(screen.getByText("Putnik 1")).toBeTruthy()
  })

  it("shows a single page with every step unavailable for an empty table", () => {
    render(<DataTable columns={columns} data={[]} />)

    expect(screen.getByText("Strana 1 od 1")).toBeTruthy()
    expect(pageButtons()).toEqual(["1"])
    for (const name of ["Prva strana", "Prethodna strana", "Sledeca strana", "Poslednja strana"]) {
      expect(stepButton(name).getAttribute("aria-disabled")).toBe("true")
    }
  })

  it("goes back to the first page when a search shrinks the table", async () => {
    render(<DataTable columns={columns} data={rows} searchColumn="name" searchDebounceMs={0} />)
    fireEvent.click(screen.getByRole("button", { name: "Idi na stranu 42" }))

    // Matches Putnik 3, 30-39 and 300-336: 48 rows, 6 pages.
    fireEvent.change(screen.getByPlaceholderText("Pretraga..."), { target: { value: "Putnik 3" } })

    await waitFor(() => expect(screen.getByText("Strana 1 od 6")).toBeTruthy())
    expect(screen.getByText("Putnik 3")).toBeTruthy()
    expect(pageButtons()).toEqual(["1", "2", "3", "4", "5", "6"])
  })
})
