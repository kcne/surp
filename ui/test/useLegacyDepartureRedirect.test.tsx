import { renderHook, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { departure } from "./fixtures"
import { createQueryWrapper } from "./queryWrapper"

const api = vi.hoisted(() => ({ departuresControllerList: vi.fn(), departuresControllerGetById: vi.fn() }))
const router = vi.hoisted(() => ({ replace: vi.fn() }))

vi.mock("@/infrastructure/generated/surp-api", () => api)
vi.mock("next/navigation", () => ({ useRouter: () => router }))

import { useLegacyDepartureRedirect } from "@/hooks/useLegacyDepartureRedirect"

const link = { rideId: "ride-1", date: "2026-10-05", departureTime: "09:00" }
const hrefFor = (id: string) => `/reservations/${id}`

describe("useLegacyDepartureRedirect", () => {
  beforeEach(() => {
    api.departuresControllerList.mockReset()
    router.replace.mockReset()
  })

  it("replaces an old link with the departure it meant", async () => {
    api.departuresControllerList.mockResolvedValue({
      status: 200,
      data: { items: [departure({ id: "dep-meant" }), departure({ id: "dep-15", departureTime: "15:00" })] },
    })

    const { result } = renderHook(() => useLegacyDepartureRedirect(link, hrefFor), {
      wrapper: createQueryWrapper(),
    })

    await waitFor(() => expect(router.replace).toHaveBeenCalledWith("/reservations/dep-meant"))
    expect(api.departuresControllerList).toHaveBeenCalledWith({
      from: "2026-10-05",
      to: "2026-10-05",
      rideId: "ride-1",
    })
    expect(result.current.notFound).toBe(false)
  })

  it("says not found instead of guessing between two buses at that time", async () => {
    api.departuresControllerList.mockResolvedValue({
      status: 200,
      data: { items: [departure({ id: "dep-a" }), departure({ id: "dep-b", source: "EXTRA" })] },
    })

    const { result } = renderHook(() => useLegacyDepartureRedirect(link, hrefFor), {
      wrapper: createQueryWrapper(),
    })

    await waitFor(() => expect(result.current.notFound).toBe(true))
    expect(result.current.resolving).toBe(false)
    expect(router.replace).not.toHaveBeenCalled()
  })

  it("reports a failed read as an error, not as a link to no bus, and retries it", async () => {
    api.departuresControllerList.mockResolvedValue({ status: 500, data: {} })

    const { result } = renderHook(() => useLegacyDepartureRedirect(link, hrefFor), {
      wrapper: createQueryWrapper(),
    })

    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(result.current.notFound).toBe(false)
    expect(result.current.resolving).toBe(false)

    api.departuresControllerList.mockResolvedValue({
      status: 200,
      data: { items: [departure({ id: "dep-meant" })] },
    })
    await result.current.retry()

    await waitFor(() => expect(router.replace).toHaveBeenCalledWith("/reservations/dep-meant"))
  })

  it("does nothing for a link that already names a departure", () => {
    const { result } = renderHook(() => useLegacyDepartureRedirect(null, hrefFor), {
      wrapper: createQueryWrapper(),
    })

    expect(result.current).toMatchObject({ resolving: false, notFound: false, isError: false })
    expect(api.departuresControllerList).not.toHaveBeenCalled()
  })
})
