import { renderHook, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { departure, ride } from "./fixtures"
import { createQueryWrapper } from "./queryWrapper"

const api = vi.hoisted(() => ({
  departuresControllerList: vi.fn(),
  departuresControllerGetById: vi.fn(),
}))

vi.mock("@/infrastructure/generated/surp-api", () => api)

import {
  useDepartureQuery,
  useRunningDeparturesQuery,
} from "@/infrastructure/hooks/queries/useDeparturesQuery"

describe("useRunningDeparturesQuery", () => {
  beforeEach(() => {
    api.departuresControllerList.mockReset()
  })

  it("reads a range longer than 62 days in windows, and keeps only running buses", async () => {
    api.departuresControllerList.mockImplementation(async (params: { from: string }) => ({
      status: 200,
      data: {
        from: params.from,
        to: params.from,
        items:
          params.from === "2026-10-01"
            ? [
                departure({ id: "running", serviceDate: "2026-10-05" }),
                departure({ id: "cancelled", cancelledAt: "2026-10-02T08:00:00.000Z" }),
              ]
            : [departure({ id: "later", serviceDate: "2026-12-10", source: "EXTRA" })],
      },
    }))

    const rides = [ride()]
    const { result } = renderHook(
      () => useRunningDeparturesQuery({ from: "2026-10-01", to: "2027-01-15" }, rides, { rideId: "ride-1" }),
      { wrapper: createQueryWrapper() }
    )

    await waitFor(() => expect(result.current.isLoading).toBe(false))

    expect(api.departuresControllerList).toHaveBeenCalledTimes(2)
    expect(api.departuresControllerList).toHaveBeenCalledWith({
      from: "2026-10-01",
      to: "2026-12-01",
      rideId: "ride-1",
    })
    expect(api.departuresControllerList).toHaveBeenCalledWith({
      from: "2026-12-02",
      to: "2027-01-15",
      rideId: "ride-1",
    })
    expect(result.current.instances.map((instance) => [instance.id, instance.source])).toEqual([
      ["running", "BASE"],
      ["later", "ADDITIONAL"],
    ])
  })

  it("asks nothing while disabled or without a range", () => {
    renderHook(
      () => useRunningDeparturesQuery({ from: "", to: "" }, [], { enabled: true }),
      { wrapper: createQueryWrapper() }
    )
    renderHook(
      () => useRunningDeparturesQuery({ from: "2026-10-01", to: "2026-10-01" }, [], { enabled: false }),
      { wrapper: createQueryWrapper() }
    )

    expect(api.departuresControllerList).not.toHaveBeenCalled()
  })

  it("reports a failed window as an error", async () => {
    api.departuresControllerList.mockResolvedValue({ status: 400, data: {} })

    const { result } = renderHook(
      () => useRunningDeparturesQuery({ from: "2026-10-01", to: "2026-10-01" }, []),
      { wrapper: createQueryWrapper() }
    )

    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(result.current.instances).toEqual([])
  })

  it("reads every window again on a retry, and clears the error once they arrive", async () => {
    api.departuresControllerList.mockResolvedValue({ status: 500, data: {} })

    const { result } = renderHook(
      () => useRunningDeparturesQuery({ from: "2026-10-01", to: "2026-12-31" }, [ride()]),
      { wrapper: createQueryWrapper() }
    )

    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(api.departuresControllerList).toHaveBeenCalledTimes(2)

    api.departuresControllerList.mockResolvedValue({
      status: 200,
      data: { items: [departure({ id: "back" })] },
    })
    await result.current.refetch()

    await waitFor(() => expect(result.current.isError).toBe(false))
    expect(api.departuresControllerList).toHaveBeenCalledTimes(4)
    expect(result.current.instances.map((instance) => instance.id)).toEqual(["back", "back"])
  })
})

describe("useDepartureQuery", () => {
  it("answers null for a departure the tenant does not have", async () => {
    api.departuresControllerGetById.mockResolvedValue({ status: 404, data: {} })

    const { result } = renderHook(() => useDepartureQuery("missing"), {
      wrapper: createQueryWrapper(),
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toBeNull()
  })

  it("reads one departure by its ID", async () => {
    api.departuresControllerGetById.mockResolvedValue({ status: 200, data: departure({ id: "dep-7" }) })

    const { result } = renderHook(() => useDepartureQuery("dep-7"), {
      wrapper: createQueryWrapper(),
    })

    await waitFor(() => expect(result.current.data?.id).toBe("dep-7"))
    expect(api.departuresControllerGetById).toHaveBeenCalledWith("dep-7")
  })
})
