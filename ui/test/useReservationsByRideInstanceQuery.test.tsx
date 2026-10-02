import { renderHook, waitFor } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { toDepartureInstance } from "@/infrastructure/mappers/departureMappers"
import { departure, ride } from "./fixtures"
import { createQueryWrapper } from "./queryWrapper"

const api = vi.hoisted(() => ({ reservationsControllerList: vi.fn() }))

vi.mock("@/infrastructure/generated/surp-api", () => api)

import { useReservationsByRideInstanceQuery } from "@/infrastructure/hooks/queries/useReservationsByRideInstanceQuery"

describe("useReservationsByRideInstanceQuery", () => {
  it("reads a bus's reservations by its departureId, not by its time", async () => {
    api.reservationsControllerList.mockResolvedValue({ status: 200, data: { items: [], total: 0 } })
    const instance = toDepartureInstance(departure({ id: "dep-42" }), ride())

    const { result } = renderHook(() => useReservationsByRideInstanceQuery(instance), {
      wrapper: createQueryWrapper(),
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(api.reservationsControllerList).toHaveBeenCalledWith({
      page: 1,
      pageSize: 100,
      departureId: "dep-42",
    })
  })
})
