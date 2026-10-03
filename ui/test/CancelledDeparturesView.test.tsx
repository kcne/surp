import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { departure, refusal } from "./fixtures"
import { createQueryWrapper } from "./queryWrapper"

const api = vi.hoisted(() => ({
  departuresControllerList: vi.fn(),
  departuresControllerRestore: vi.fn(),
}))
const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }))

vi.mock("@/infrastructure/generated/surp-api", () => api)
vi.mock("sonner", () => ({ toast }))

import { CancelledDeparturesView } from "@/components/rides/CancelledDeparturesView"

/**
 * Answers with the departures dated inside the range, filtered as the API
 * filters cancelled=true: operator-cancelled, LEGACY left out.
 */
function serve(departures: ReturnType<typeof departure>[]) {
  api.departuresControllerList.mockImplementation(
    async (params: { from: string; to: string; cancelled?: string }) => ({
      status: 200,
      data: {
        items: departures.filter(
          (item) =>
            item.serviceDate >= params.from &&
            item.serviceDate <= params.to &&
            (params.cancelled !== "true" || (item.cancelledAt !== null && item.source !== "LEGACY"))
        ),
      },
    })
  )
}

const cancelledAt = "2026-10-02T08:00:00.000Z"

describe("CancelledDeparturesView (#27, PR 4c)", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] })
    vi.setSystemTime(new Date("2026-10-03T10:00:00"))
    api.departuresControllerList.mockReset()
    api.departuresControllerRestore.mockReset()
    toast.success.mockReset()
    toast.error.mockReset()
  })

  afterEach(() => {
    cleanup()
    vi.useRealTimers()
  })

  it("reads today to +365 days and lists only operator-cancelled departures, nearest first", async () => {
    serve([
      departure({ id: "running", serviceDate: "2026-10-05" }),
      departure({ id: "dropped", serviceDate: "2026-10-05", timetableDroppedAt: cancelledAt }),
      departure({ id: "legacy", serviceDate: "2026-10-06", source: "LEGACY", cancelledAt }),
      departure({ id: "late", serviceDate: "2027-09-30", departureTime: "07:00", cancelledAt, lineName: "Kasna" }),
      departure({
        id: "extra",
        serviceDate: "2026-10-04",
        source: "EXTRA",
        departureTime: "15:00",
        cancelledAt,
        activeReservationCount: 4,
        lineName: "Rana",
      }),
    ])
    render(<CancelledDeparturesView />, { wrapper: createQueryWrapper() })

    await waitFor(() => expect(screen.getAllByRole("row")).toHaveLength(3))

    // One request for the year, filtered by the API, not six 62-day windows
    // of every departure.
    expect(api.departuresControllerList.mock.calls.map(([params]) => params)).toEqual([
      { from: "2026-10-03", to: "2027-10-03", cancelled: "true" },
    ])

    const [, first, second] = screen.getAllByRole("row")
    expect(within(first).getByText("Rana")).toBeTruthy()
    expect(within(first).getByText("Dodatni")).toBeTruthy()
    expect(within(first).getByText("4")).toBeTruthy()
    expect(within(second).getByText("Kasna")).toBeTruthy()
    expect(within(second).getByText("Redovni")).toBeTruthy()
  })

  it("restores a departure with 'Vrati' and refetches the list", async () => {
    const list = [departure({ id: "dep-9", serviceDate: "2026-10-05", cancelledAt })]
    serve(list)
    api.departuresControllerRestore.mockImplementation(async () => {
      serve([{ ...list[0], cancelledAt: null }])
      return { status: 200, data: { ...list[0], cancelledAt: null } }
    })
    render(<CancelledDeparturesView />, { wrapper: createQueryWrapper() })

    fireEvent.click(await screen.findByRole("button", { name: /Vrati polazak 2026-10-05 u 09:00/ }))

    await waitFor(() => expect(api.departuresControllerRestore).toHaveBeenCalledWith("dep-9"))
    expect(await screen.findByText("Nema otkazanih polazaka")).toBeTruthy()
    expect(toast.success).toHaveBeenCalledWith("Polazak je vracen u saobracaj")
  })

  it("does not offer 'Vrati' for a cancelled bus the timetable does not make now, and says why", async () => {
    serve([
      departure({ id: "dep-9", serviceDate: "2026-10-05", cancelledAt, timetableDroppedAt: cancelledAt }),
      departure({ id: "dep-10", serviceDate: "2026-10-06", cancelledAt }),
    ])
    render(<CancelledDeparturesView />, { wrapper: createQueryWrapper() })

    const notRunning = await screen.findByRole("button", { name: /Vrati polazak 2026-10-05 u 09:00/ })
    expect((notRunning as HTMLButtonElement).disabled).toBe(true)
    expect(within(notRunning.closest("tr")!).getByText("Ne saobraca")).toBeTruthy()
    expect(screen.getByText(/moze se vratiti tek kada voznja ili linija ponovo saobraca/)).toBeTruthy()

    const running = screen.getByRole("button", { name: /Vrati polazak 2026-10-06 u 09:00/ })
    expect((running as HTMLButtonElement).disabled).toBe(false)
  })

  it("shows the server's sentence when a restore is refused", async () => {
    serve([departure({ id: "dep-9", serviceDate: "2026-10-05", cancelledAt })])
    api.departuresControllerRestore.mockRejectedValue(
      refusal("DEPARTURE_NOT_CANCELLED", "Polazak nije otkazan.")
    )
    render(<CancelledDeparturesView />, { wrapper: createQueryWrapper() })

    fireEvent.click(await screen.findByRole("button", { name: /Vrati polazak 2026-10-05 u 09:00/ }))

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Polazak nije otkazan."))
  })

  it("offers a retry when the departures cannot be read", async () => {
    api.departuresControllerList.mockResolvedValue({ status: 500, data: {} })
    render(<CancelledDeparturesView />, { wrapper: createQueryWrapper() })

    expect((await screen.findByRole("alert")).textContent).toContain("Polasci nisu mogli biti ucitani.")

    serve([departure({ id: "dep-9", serviceDate: "2026-10-05", cancelledAt })])
    fireEvent.click(screen.getByRole("button", { name: "Pokusaj ponovo" }))

    expect(await screen.findByRole("button", { name: /Vrati polazak 2026-10-05/ })).toBeTruthy()
  })
})
