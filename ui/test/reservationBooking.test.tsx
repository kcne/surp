import type { ReactNode } from "react"
import { act, renderHook } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { departure, refusal, reservationResponse, ride } from "./fixtures"

const api = vi.hoisted(() => ({
  reservationsControllerCreate: vi.fn(),
  reservationsControllerCreateBatch: vi.fn(),
}))
const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }))

vi.mock("@/infrastructure/generated/surp-api", () => api)
vi.mock("sonner", () => ({ toast }))

import {
  useCreateReservationMutation,
  useCreateReservationsBatchMutation,
} from "@/infrastructure/hooks/mutations/useReservationMutations"
import { toDepartureInstance } from "@/infrastructure/mappers/departureMappers"
import { toCreateReservationDto } from "@/infrastructure/mappers/reservationMappers"
import type { ReservationFormData } from "@/types"

const outbound = toDepartureInstance(departure({ id: "dep-out" }), ride())
const inbound = toDepartureInstance(
  departure({
    id: "dep-back",
    rideId: "ride-2",
    serviceDate: "2026-10-07",
    departureTime: "17:00",
    arrivalTime: "18:30",
  })
)

function form(overrides: Partial<ReservationFormData> = {}): ReservationFormData {
  return {
    rideInstanceId: outbound.id,
    passengerId: "pass-1",
    seatNumber: 4,
    departureStationId: "st-ns",
    arrivalStationId: "st-bg",
    ...overrides,
  }
}

function setup() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const invalidate = vi.spyOn(client, "invalidateQueries")
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  )

  return { invalidate, wrapper }
}

describe("toCreateReservationDto", () => {
  it("books the departure by ID, with the ride, date and times the departure has", () => {
    expect(toCreateReservationDto(form(), outbound)).toMatchObject({
      departureId: "dep-out",
      rideId: "ride-1",
      travelDate: "2026-10-05",
      rideDepartureTime: "09:00",
      rideArrivalTime: "10:30",
      seatNumber: 4,
    })
  })

  it("refuses a bus that was not read from a departure", () => {
    const { departureId: _departureId, ...pieced } = outbound

    expect(() => toCreateReservationDto(form(), pieced)).toThrow(
      "Polazak nije ucitan. Osvezite stranicu i izaberite polazak ponovo."
    )
  })
})

describe("booking mutations", () => {
  beforeEach(() => {
    api.reservationsControllerCreate.mockReset()
    api.reservationsControllerCreateBatch.mockReset()
    toast.success.mockReset()
    toast.error.mockReset()
  })

  it("sends departureId with a single booking", async () => {
    api.reservationsControllerCreate.mockResolvedValue({ status: 201, data: reservationResponse() })
    const { wrapper } = setup()
    const { result } = renderHook(() => useCreateReservationMutation(), { wrapper })

    await act(() => result.current.mutateAsync({ data: form(), rideInstance: outbound }))

    expect(api.reservationsControllerCreate).toHaveBeenCalledWith(
      expect.objectContaining({ departureId: "dep-out" })
    )
  })

  it("sends each leg of a return trip with its own departure", async () => {
    api.reservationsControllerCreateBatch.mockResolvedValue({
      status: 201,
      data: {
        totalRequested: 2,
        createdCount: 2,
        failedCount: 0,
        items: [
          { index: 0, success: true, reservation: reservationResponse() },
          { index: 1, success: true, reservation: reservationResponse({ id: "res-2" }) },
        ],
      },
    })
    const { wrapper } = setup()
    const { result } = renderHook(() => useCreateReservationsBatchMutation(), { wrapper })

    await act(() =>
      result.current.mutateAsync({
        data: [
          form(),
          form({
            rideInstanceId: inbound.id,
            departureStationId: "st-bg",
            arrivalStationId: "st-ns",
            returnOfIndex: 0,
          }),
        ],
        rideInstance: outbound,
        returnRideInstance: inbound,
      })
    )

    const [{ items }] = api.reservationsControllerCreateBatch.mock.calls[0]
    expect(items).toEqual([
      expect.objectContaining({ departureId: "dep-out", travelDate: "2026-10-05", rideDepartureTime: "09:00" }),
      expect.objectContaining({
        departureId: "dep-back",
        rideId: "ride-2",
        travelDate: "2026-10-07",
        rideDepartureTime: "17:00",
        returnOfIndex: 0,
      }),
    ])
  })

  it.each([
    ["DEPARTURE_CHANGED", "Polazak 2026-10-05 u 09:30 (dolazak 11:00) se ne slaze sa podacima na stranici."],
    ["DEPARTURE_NOT_RUNNING", "Polazak 2026-10-05 u 09:00 je otkazan i ne prima rezervacije."],
    ["DEPARTURE_NOT_FOUND", "Izabrani polazak vise ne postoji. Osvezite stranicu i izaberite polazak ponovo."],
  ])("shows the server's %s sentence and refetches the departures", async (code, message) => {
    api.reservationsControllerCreate.mockRejectedValue(refusal(code, message))
    const { invalidate, wrapper } = setup()
    const { result } = renderHook(() => useCreateReservationMutation(), { wrapper })

    await act(async () => {
      await expect(
        result.current.mutateAsync({ data: form(), rideInstance: outbound })
      ).rejects.toBeDefined()
    })

    expect(toast.error).toHaveBeenCalledWith(message)
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ["departures"] })
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ["reservations"] })
  })

  it("refetches the departures when a batch is refused", async () => {
    api.reservationsControllerCreateBatch.mockRejectedValue(
      refusal("DEPARTURE_NOT_RUNNING", "Polazak 2026-10-07 u 17:00 je otkazan i ne prima rezervacije.")
    )
    const { invalidate, wrapper } = setup()
    const { result } = renderHook(() => useCreateReservationsBatchMutation(), { wrapper })

    await act(async () => {
      await expect(
        result.current.mutateAsync({ data: [form(), form({ seatNumber: 5 })], rideInstance: outbound })
      ).rejects.toBeDefined()
    })

    expect(toast.error).toHaveBeenCalledWith(
      "Polazak 2026-10-07 u 17:00 je otkazan i ne prima rezervacije."
    )
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ["departures"] })
  })
})
