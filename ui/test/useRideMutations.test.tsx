import { renderHook } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { createQueryWrapper } from "./queryWrapper"
import { refusal } from "./fixtures"

const api = vi.hoisted(() => ({
  ridesControllerCreate: vi.fn(),
  ridesControllerGetById: vi.fn(),
  ridesControllerRemove: vi.fn(),
  ridesControllerReplace: vi.fn(),
  ridesControllerUpdate: vi.fn(),
  ridesControllerAddException: vi.fn(),
  ridesControllerRemoveException: vi.fn(),
}))

vi.mock("@/infrastructure/generated/surp-api", () => api)
const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }))
vi.mock("sonner", () => ({ toast }))

import {
  RideHasReservationsError,
  useCreateRideMutation,
  useDeleteUnbookedRideMutation,
  useUpdateRideMutation,
} from "@/infrastructure/hooks/mutations/useRideMutations"

const rideDto = { id: "ride-1", exceptions: [] }

describe("ride mutations (#27, PR 4c)", () => {
  beforeEach(() => {
    for (const mock of Object.values(api)) {
      mock.mockReset()
    }
    toast.success.mockReset()
    toast.error.mockReset()
    api.ridesControllerCreate.mockResolvedValue({ status: 201, data: rideDto })
    api.ridesControllerUpdate.mockResolvedValue({ status: 200, data: rideDto })
    api.ridesControllerGetById.mockResolvedValue({ status: 200, data: rideDto })
  })

  // The ride form's state still carries the ride's exceptions when it was
  // filled from a ride. A cancelled date or an extra bus is now an operation
  // on its departure, so a stale copy must never be written back.
  const formState = {
    lineId: "line-1",
    busCapacity: 40,
    type: "recurring" as const,
    exceptions: [{ id: "stale", date: "2026-10-05", type: "skip" as const }],
  }

  it("creates a ride without writing exceptions", async () => {
    const { result } = renderHook(() => useCreateRideMutation(), { wrapper: createQueryWrapper() })

    await result.current.mutateAsync(formState)

    expect(api.ridesControllerCreate).toHaveBeenCalledTimes(1)
    expect(api.ridesControllerAddException).not.toHaveBeenCalled()
  })

  it("updates a ride without adding or removing exceptions", async () => {
    const { result } = renderHook(() => useUpdateRideMutation(), { wrapper: createQueryWrapper() })

    await result.current.mutateAsync({ id: "ride-1", payload: { busCapacity: 40, exceptions: formState.exceptions } as never })

    expect(api.ridesControllerUpdate).toHaveBeenCalledTimes(1)
    expect(api.ridesControllerUpdate.mock.calls[0][1]).not.toHaveProperty("exceptions")
    expect(api.ridesControllerAddException).not.toHaveBeenCalled()
    expect(api.ridesControllerRemoveException).not.toHaveBeenCalled()
  })

  // Deleting a one-time ride from its departures list must never cancel a
  // passenger: the server, not the screen's read, decides whether anyone is
  // booked.
  describe("deleting an unbooked one-time ride", () => {
    it("deletes without cascade", async () => {
      api.ridesControllerRemove.mockResolvedValue({ status: 200, data: rideDto })
      const { result } = renderHook(() => useDeleteUnbookedRideMutation(), { wrapper: createQueryWrapper() })

      await result.current.mutateAsync("ride-1")

      expect(api.ridesControllerRemove).toHaveBeenCalledWith("ride-1")
      expect(toast.success).toHaveBeenCalledWith("Voznja je uspesno obrisana")
    })

    it("reports a ride the server keeps for its reservations without a toast", async () => {
      api.ridesControllerRemove.mockRejectedValue(
        Object.assign(new Error("Request failed with status code 409"), {
          response: {
            status: 409,
            data: { statusCode: 409, message: "Ride cannot be deleted because it has active reservations." },
          },
        })
      )
      const { result } = renderHook(() => useDeleteUnbookedRideMutation(), { wrapper: createQueryWrapper() })

      await expect(result.current.mutateAsync("ride-1")).rejects.toBeInstanceOf(RideHasReservationsError)
      expect(toast.error).not.toHaveBeenCalled()
    })

    it("tells a busy schedule apart from a booked ride", async () => {
      api.ridesControllerRemove.mockRejectedValue(
        refusal("SCHEDULE_BEING_UPDATED", "Raspored se upravo menja. Pokusajte ponovo.")
      )
      const { result } = renderHook(() => useDeleteUnbookedRideMutation(), { wrapper: createQueryWrapper() })

      const failure = await result.current.mutateAsync("ride-1").catch((error: unknown) => error)

      expect(failure).not.toBeInstanceOf(RideHasReservationsError)
      expect(toast.error).toHaveBeenCalledWith("Raspored se upravo menja. Pokusajte ponovo.")
    })
  })
})
