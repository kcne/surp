import { act, render, renderHook, screen, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { departure } from "./fixtures"
import { createQueryWrapper } from "./queryWrapper"

const searchParams = vi.hoisted(() => new URLSearchParams())
const api = vi.hoisted(() => ({
  departuresControllerList: vi.fn(),
  departuresControllerGetById: vi.fn(),
  ridesControllerList: vi.fn(),
  reservationsControllerList: vi.fn(),
  reservationsControllerMoveSeat: vi.fn(),
}))

vi.mock("@/infrastructure/generated/surp-api", () => api)
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn() }),
  useSearchParams: () => searchParams,
}))

import { SelectedSeatsBar } from "@/components/reservations/SelectedSeatsBar"
import { useRideInstanceSeatMapPage } from "@/hooks/useRideInstanceSeatMapPage"

const EMPTY_PAGE = { status: 200, data: { items: [], total: 0 } }

describe("useRideInstanceSeatMapPage", () => {
  beforeEach(() => {
    api.departuresControllerGetById.mockReset()
    api.ridesControllerList.mockReset().mockResolvedValue(EMPTY_PAGE)
    api.reservationsControllerList.mockReset().mockResolvedValue(EMPTY_PAGE)
  })

  it("takes bookings on a running departure", async () => {
    api.departuresControllerGetById.mockResolvedValue({ status: 200, data: departure() })

    const { result } = renderHook(() => useRideInstanceSeatMapPage({ rideInstanceId: "dep-1" }), {
      wrapper: createQueryWrapper(),
    })

    await waitFor(() => expect(result.current.selectedRideInstance).not.toBeNull())
    expect(result.current.bookingClosed).toBe(false)
  })

  it.each([
    ["cancelled", { cancelledAt: "2026-10-02T10:00:00.000Z" }],
    ["dropped", { timetableDroppedAt: "2026-10-02T10:00:00.000Z" }],
    ["LEGACY", { source: "LEGACY" as const }],
  ])("closes booking on a %s departure and its open booking form", async (_kind, overrides) => {
    api.departuresControllerGetById.mockResolvedValue({ status: 200, data: departure() })

    const { result } = renderHook(() => useRideInstanceSeatMapPage({ rideInstanceId: "dep-1" }), {
      wrapper: createQueryWrapper(),
    })

    await waitFor(() => expect(result.current.selectedRideInstance).not.toBeNull())
    act(() => result.current.setIsMultiReservationModalOpen(true))
    expect(result.current.isMultiReservationModalOpen).toBe(true)

    // A refused booking refetches the departure, which no longer runs.
    api.departuresControllerGetById.mockResolvedValue({ status: 200, data: departure(overrides) })
    await act(async () => {
      await result.current.retryDeparture()
    })

    await waitFor(() => expect(result.current.bookingClosed).toBe(true))
    expect(result.current.isMultiReservationModalOpen).toBe(false)
  })
})

describe("SelectedSeatsBar", () => {
  it("disables booking free seats on a bus that takes no bookings", () => {
    render(
      <SelectedSeatsBar
        selectedSeats={[3]}
        onRemoveSeat={vi.fn()}
        onClear={vi.fn()}
        onReserve={vi.fn()}
        reserveDisabled
      />
    )

    expect(screen.getByRole<HTMLButtonElement>("button", { name: /Rezervi/ }).disabled).toBe(true)
  })
})
