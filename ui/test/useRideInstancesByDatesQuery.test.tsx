import { act, renderHook, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { departure, ride } from "./fixtures"
import { createQueryWrapper } from "./queryWrapper"

const api = vi.hoisted(() => ({
  departuresControllerList: vi.fn(),
  departuresControllerGetById: vi.fn(),
}))

vi.mock("@/infrastructure/generated/surp-api", () => api)

import { useRideInstancesByDatesQuery } from "@/infrastructure/hooks/queries/useRideInstancesByDatesQuery"

const DATES = ["2026-10-05", "2027-03-01"]
const RIDES = [ride()]

describe("useRideInstancesByDatesQuery", () => {
  beforeEach(() => {
    api.departuresControllerList.mockReset()
  })

  it("reports a failed window instead of leaving its dates as if they had no bus, and retries it", async () => {
    api.departuresControllerList.mockImplementation(async (params: { from: string }) =>
      params.from === "2026-10-05"
        ? { status: 500, data: {} }
        : { status: 200, data: { items: [departure({ id: "march", serviceDate: "2027-03-01" })] } }
    )

    const { result } = renderHook(() => useRideInstancesByDatesQuery(DATES, RIDES), {
      wrapper: createQueryWrapper(),
    })

    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(result.current.rideInstancesByDate["2026-10-05"]).toEqual([])
    expect(result.current.rideInstancesByDate["2027-03-01"].map((instance) => instance.id)).toEqual(["march"])

    api.departuresControllerList.mockImplementation(async (params: { from: string }) => ({
      status: 200,
      data: {
        items: [
          params.from === "2026-10-05"
            ? departure({ id: "october" })
            : departure({ id: "march", serviceDate: "2027-03-01" }),
        ],
      },
    }))
    await act(() => result.current.refetch())

    await waitFor(() => expect(result.current.isError).toBe(false))
    expect(result.current.rideInstancesByDate["2026-10-05"].map((instance) => instance.id)).toEqual(["october"])
  })
})
