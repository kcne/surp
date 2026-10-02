import { act, renderHook, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { departure } from "./fixtures"
import { createQueryWrapper } from "./queryWrapper"

const api = vi.hoisted(() => ({
  departuresControllerList: vi.fn(),
  departuresControllerGetById: vi.fn(),
  ridesControllerList: vi.fn(),
  linesControllerList: vi.fn(),
}))

vi.mock("@/infrastructure/generated/surp-api", () => api)

import { usePassengerListsPage } from "@/hooks/usePassengerListsPage"

const EMPTY_PAGE = { status: 200, data: { items: [], total: 0 } }

describe("usePassengerListsPage", () => {
  beforeEach(() => {
    api.departuresControllerList.mockReset()
    api.ridesControllerList.mockReset().mockResolvedValue(EMPTY_PAGE)
    api.linesControllerList.mockReset().mockResolvedValue(EMPTY_PAGE)
  })

  it("reports a failed departures read and retries it, not only the rides", async () => {
    api.departuresControllerList.mockResolvedValue({ status: 500, data: {} })

    const { result } = renderHook(() => usePassengerListsPage(), { wrapper: createQueryWrapper() })

    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(result.current.error).toBeInstanceOf(Error)

    api.departuresControllerList.mockResolvedValue({
      status: 200,
      data: { items: [departure({ id: "today", serviceDate: result.current.selectedDate })] },
    })
    await act(() => result.current.refetch())

    await waitFor(() => expect(result.current.isError).toBe(false))
    expect(result.current.items.map((item) => item.rideInstance.id)).toEqual(["today"])
  })
})
