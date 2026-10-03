import type { ReactNode } from "react"
import { act, renderHook } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { departure, refusal, reservationResponse, ride } from "./fixtures"

const api = vi.hoisted(() => ({
  passengersControllerCreate: vi.fn(),
  reservationsControllerCreateBatch: vi.fn(),
}))
const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }))

vi.mock("@/infrastructure/generated/surp-api", () => api)
vi.mock("sonner", () => ({ toast }))

import { useImportCommit, type ImportCommitResult } from "@/hooks/useImportCommit"
import { toDepartureInstance } from "@/infrastructure/mappers/departureMappers"
import type { ImportRowState } from "@/lib/csv-import"

const morning = toDepartureInstance(departure({ id: "dep-morning" }), ride())
const evening = toDepartureInstance(
  departure({ id: "dep-evening", departureTime: "18:00", arrivalTime: "19:30" }),
  ride()
)
const rideInstancesById = { [morning.id]: morning, [evening.id]: evening }

function row(id: string, rideInstanceId: string, seatNumber: number): ImportRowState {
  return {
    id,
    groupKey: id,
    leg: "outbound",
    source: {
      lineNumber: Number(id.replace(/\D/g, "")),
      externalId: id,
      name: "Ana Petrovic",
      departure: "Novi Sad",
      arrival: "Beograd",
      travelDate: "05.10.2026",
      phone: "0601234567",
    },
    firstName: "Ana",
    lastName: "Petrovic",
    phone: "+381601234567",
    passengerId: "pass-1",
    travelDate: "2026-10-05",
    departureStationId: "st-ns",
    arrivalStationId: "st-bg",
    departureMatch: "exact",
    arrivalMatch: "exact",
    rideInstanceId,
    rideInstanceCandidateIds: [morning.id, evening.id],
    seatNumber,
    seatIsAutoAssigned: true,
    notes: "",
    excluded: false,
    duplicateResolution: null,
    issues: [],
    isValid: true,
    duplicate: null,
  }
}

function setup() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const invalidate = vi.spyOn(client, "invalidateQueries")
  const onCompleted = vi.fn<(result: ImportCommitResult) => void>()
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  )
  const { result } = renderHook(
    () => useImportCommit({ rideInstancesById, onPassengersLinked: vi.fn(), onCompleted }),
    { wrapper }
  )

  return { result, invalidate, onCompleted }
}

describe("useImportCommit", () => {
  beforeEach(() => {
    api.reservationsControllerCreateBatch.mockReset()
    toast.success.mockReset()
    toast.error.mockReset()
  })

  it("books every row on the departure it was matched to", async () => {
    api.reservationsControllerCreateBatch.mockImplementation(async ({ items }: { items: unknown[] }) => ({
      status: 201,
      data: {
        totalRequested: items.length,
        createdCount: items.length,
        failedCount: 0,
        items: items.map((_item, index) => ({ index, success: true, reservation: reservationResponse() })),
      },
    }))
    const { result, onCompleted } = setup()

    await act(() => result.current.commit([row("r1", morning.id, 1), row("r2", evening.id, 2)]))

    const sent = api.reservationsControllerCreateBatch.mock.calls.map(([body]) => body.items)
    expect(sent).toEqual([
      [expect.objectContaining({ departureId: "dep-morning", rideDepartureTime: "09:00", seatNumber: 1 })],
      [expect.objectContaining({ departureId: "dep-evening", rideDepartureTime: "18:00", seatNumber: 2 })],
    ])
    expect(onCompleted).toHaveBeenCalledWith(
      expect.objectContaining({ importedRowIds: ["r1", "r2"], failures: [] })
    )
  })

  it("keeps the rows of a refused departure with the server's sentence and refetches the departures", async () => {
    const message = "Polazak 2026-10-05 u 18:00 je otkazan i ne prima rezervacije."
    api.reservationsControllerCreateBatch.mockImplementation(
      async ({ items }: { items: Array<{ departureId: string }> }) => {
        if (items[0].departureId === "dep-evening") {
          throw refusal("DEPARTURE_NOT_RUNNING", message)
        }

        return {
          status: 201,
          data: {
            totalRequested: 1,
            createdCount: 1,
            failedCount: 0,
            items: [{ index: 0, success: true, reservation: reservationResponse() }],
          },
        }
      }
    )
    const { result, invalidate, onCompleted } = setup()

    await act(() => result.current.commit([row("r1", morning.id, 1), row("r2", evening.id, 2)]))

    expect(onCompleted).toHaveBeenCalledWith(
      expect.objectContaining({
        importedRowIds: ["r1"],
        failures: [{ rideInstanceId: "dep-evening", rowIds: ["r2"], message }],
      })
    )
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ["departures"] })
  })
})
