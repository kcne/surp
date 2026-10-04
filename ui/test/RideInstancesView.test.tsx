import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import type { Ride } from "@/types"
import { departure, refusal, ride } from "./fixtures"
import { createQueryWrapper } from "./queryWrapper"

const api = vi.hoisted(() => ({
  departuresControllerList: vi.fn(),
  departuresControllerGetById: vi.fn(),
  departuresControllerCancel: vi.fn(),
  departuresControllerRestore: vi.fn(),
  departuresControllerCreateExtra: vi.fn(),
  departuresControllerUpdateExtra: vi.fn(),
  departuresControllerDeleteExtra: vi.fn(),
}))
const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }))

vi.mock("@/infrastructure/generated/surp-api", () => api)
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }))
vi.mock("sonner", () => ({ toast }))

import { RideInstancesView } from "@/components/rides/RideInstancesView"

function renderView(rideOverride: Ride = ride({ daysOfWeek: [1] }), onDeleteRide = vi.fn()) {
  return render(
    <RideInstancesView
      open
      onOpenChange={vi.fn()}
      ride={rideOverride}
      loading={false}
      onDeleteRide={onDeleteRide}
    />,
    { wrapper: createQueryWrapper() }
  )
}

/** The refusal a booked departure gets until its passengers are confirmed. */
function wouldBreak(token: string) {
  return Object.assign(new Error("Request failed with status code 409"), {
    response: {
      status: 409,
      data: {
        code: "WOULD_BREAK_RESERVATIONS",
        invariant: "reservation.reachable",
        affectedCount: 3,
        message: "3 putnika ostaju na otkazanom polasku.",
        confirmationToken: token,
        repairable: false,
      },
    },
  })
}

const ok = (data: unknown = departure()) => ({ status: 200, data })

/** Answers each window with the departures dated inside it. */
function serve(departures: ReturnType<typeof departure>[]) {
  api.departuresControllerList.mockImplementation(async (params: { from: string; to: string }) => ({
    status: 200,
    data: {
      items: departures.filter(
        (item) => item.serviceDate >= params.from && item.serviceDate <= params.to
      ),
    },
  }))
}

describe("RideInstancesView", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] })
    vi.setSystemTime(new Date("2026-10-03T10:00:00"))
    for (const mock of Object.values(api)) {
      mock.mockReset()
    }
    toast.success.mockReset()
    toast.error.mockReset()
  })

  afterEach(() => {
    // The dialogs render into document.body, outside the rendered container.
    cleanup()
    vi.useRealTimers()
  })

  it("keeps the date filters when the range has no departures, so it can be changed back", async () => {
    serve([])
    renderView()

    // Later windows are not read yet: the empty first one says so.
    expect(await screen.findByText("Nema polazaka u ucitanom periodu")).toBeTruthy()

    fireEvent.change(screen.getByLabelText("Do"), { target: { value: "2026-10-04" } })

    expect(await screen.findByText("Nema polazaka u izabranom periodu")).toBeTruthy()
    expect(screen.getByLabelText("Od")).toBeTruthy()
    expect(screen.getByLabelText("Do")).toBeTruthy()
    expect(screen.queryByRole("button", { name: /Prika/ })).toBeNull()

    fireEvent.change(screen.getByLabelText("Do"), { target: { value: "" } })
    expect(await screen.findByText("Nema polazaka u ucitanom periodu")).toBeTruthy()
  })

  it("reads the next 62 days on 'show more' once the loaded departures are all shown", async () => {
    serve([
      departure({ id: "near", serviceDate: "2026-10-05" }),
      departure({ id: "later", serviceDate: "2026-12-10" }),
    ])
    renderView()

    await waitFor(() => expect(screen.getAllByRole("row")).toHaveLength(2))
    expect(api.departuresControllerList).toHaveBeenCalledTimes(1)
    expect(api.departuresControllerList).toHaveBeenLastCalledWith({ from: "2026-10-03", to: "2026-12-03", rideId: "ride-1" })

    fireEvent.click(screen.getByRole("button", { name: /Prika/ }))

    await waitFor(() => expect(screen.getAllByRole("row")).toHaveLength(3))
    expect(api.departuresControllerList).toHaveBeenLastCalledWith({ from: "2026-12-04", to: "2027-02-03", rideId: "ride-1" })
  })

  it("offers a retry when the departures cannot be read", async () => {
    api.departuresControllerList.mockResolvedValue({ status: 500, data: {} })
    renderView()

    const alert = await screen.findByRole("alert")
    expect(alert.textContent).toContain("Polasci nisu mogli biti ucitani.")
    expect(screen.getByLabelText("Od")).toBeTruthy()

    serve([departure({ id: "near", serviceDate: "2026-10-05" })])
    fireEvent.click(screen.getByRole("button", { name: "Pokusaj ponovo" }))

    await waitFor(() => expect(screen.queryByRole("alert")).toBeNull())
    expect(screen.getAllByRole("row")).toHaveLength(2)
  })

  describe("departure operations (#27, PR 4c)", () => {
    it("cancels a bus by its departureId, and asks first when passengers are booked", async () => {
      serve([departure({ id: "dep-9", serviceDate: "2026-10-05", activeReservationCount: 3 })])
      api.departuresControllerCancel
        .mockRejectedValueOnce(wouldBreak("token-1"))
        .mockResolvedValueOnce(ok())
      renderView()

      fireEvent.click(await screen.findByRole("button", { name: "Otkazi polazak 2026-10-05 u 09:00" }))

      expect(await screen.findByText("3 putnika ostaju na otkazanom polasku.")).toBeTruthy()
      expect(api.departuresControllerCancel).toHaveBeenLastCalledWith("dep-9", {
        confirmationTokens: [],
        repairTokens: [],
      })
      expect(toast.error).not.toHaveBeenCalled()

      fireEvent.click(screen.getByRole("button", { name: /Ipak sacuvaj/ }))

      await waitFor(() => expect(api.departuresControllerCancel).toHaveBeenCalledTimes(2))
      expect(api.departuresControllerCancel).toHaveBeenLastCalledWith("dep-9", {
        confirmationTokens: ["token-1"],
        repairTokens: [],
      })
      await waitFor(() => expect(toast.success).toHaveBeenCalledWith("Polazak je otkazan"))
    })

    it("shows the server's sentence when a cancellation is refused", async () => {
      serve([departure({ id: "dep-9", serviceDate: "2026-10-05" })])
      api.departuresControllerCancel.mockRejectedValue(
        refusal("DEPARTURE_ALREADY_CANCELLED", "Polazak je vec otkazan.")
      )
      renderView()

      fireEvent.click(await screen.findByRole("button", { name: "Otkazi polazak 2026-10-05 u 09:00" }))

      await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Polazak je vec otkazan."))
    })

    it("deletes a one-time ride when its only bus is cancelled and nobody is booked on it", async () => {
      serve([departure({ id: "dep-9", serviceDate: "2026-10-05" })])
      const onDeleteRide = vi.fn().mockResolvedValue(true)
      const oneTime = ride({ type: "one-time", date: "2026-10-05", exceptions: [] })
      renderView(oneTime, onDeleteRide)

      fireEvent.click(await screen.findByRole("button", { name: "Otkazi polazak 2026-10-05 u 09:00" }))

      await waitFor(() => expect(onDeleteRide).toHaveBeenCalledWith(oneTime))
      expect(api.departuresControllerCancel).not.toHaveBeenCalled()
    })

    // Deleting a ride cancels every passenger it has, so a one-time ride is
    // kept, and its bus cancelled, whenever someone would lose a seat.
    it("cancels, and asks first, rather than delete a one-time ride with passengers booked", async () => {
      serve([departure({ id: "dep-9", serviceDate: "2026-10-05", activeReservationCount: 2 })])
      api.departuresControllerCancel.mockRejectedValueOnce(wouldBreak("token-1"))
      const onDeleteRide = vi.fn()
      renderView(ride({ type: "one-time", date: "2026-10-05", exceptions: [] }), onDeleteRide)

      fireEvent.click(await screen.findByRole("button", { name: "Otkazi polazak 2026-10-05 u 09:00" }))

      expect(await screen.findByText("3 putnika ostaju na otkazanom polasku.")).toBeTruthy()
      expect(api.departuresControllerCancel).toHaveBeenCalledWith("dep-9", expect.anything())
      expect(onDeleteRide).not.toHaveBeenCalled()
    })

    it("keeps a one-time ride whose cancelled extra still has passengers on it", async () => {
      // The cancelled extra has lost its ADDITIONAL and is not listed, but
      // its passengers stay on it.
      serve([
        departure({ id: "dep-9", serviceDate: "2026-10-05" }),
        departure({
          id: "extra-cancelled",
          source: "EXTRA",
          serviceDate: "2026-10-05",
          departureTime: "15:00",
          cancelledAt: "2026-10-02T08:00:00.000Z",
          activeReservationCount: 2,
        }),
      ])
      api.departuresControllerCancel.mockResolvedValue(ok())
      const onDeleteRide = vi.fn()
      renderView(ride({ type: "one-time", date: "2026-10-05", exceptions: [] }), onDeleteRide)

      expect(screen.queryByRole("button", { name: "Otkazi polazak 2026-10-05 u 15:00" })).toBeNull()
      fireEvent.click(await screen.findByRole("button", { name: "Otkazi polazak 2026-10-05 u 09:00" }))

      await waitFor(() => expect(api.departuresControllerCancel).toHaveBeenCalledWith("dep-9", expect.anything()))
      expect(onDeleteRide).not.toHaveBeenCalled()
    })

    it("reads the ride's departures again, so an extra added since keeps the ride", async () => {
      serve([departure({ id: "dep-9", serviceDate: "2026-10-05" })])
      api.departuresControllerCancel.mockResolvedValue(ok())
      const onDeleteRide = vi.fn()
      renderView(ride({ type: "one-time", date: "2026-10-05", exceptions: [] }), onDeleteRide)
      const cancel = await screen.findByRole("button", { name: "Otkazi polazak 2026-10-05 u 09:00" })

      // Added in another tab; this list has not refetched.
      serve([
        departure({ id: "dep-9", serviceDate: "2026-10-05" }),
        departure({ id: "extra-new", source: "EXTRA", serviceDate: "2026-10-05", departureTime: "15:00" }),
      ])
      fireEvent.click(cancel)

      await waitFor(() => expect(api.departuresControllerCancel).toHaveBeenCalledWith("dep-9", expect.anything()))
      expect(onDeleteRide).not.toHaveBeenCalled()
    })

    // A seat sold after the read above, or one on a past date the read does
    // not reach: the server keeps the ride, and the bus is cancelled instead.
    it("cancels the bus, asking first, when the server keeps the ride for its reservations", async () => {
      serve([departure({ id: "dep-9", serviceDate: "2026-10-05" })])
      api.departuresControllerCancel.mockRejectedValueOnce(wouldBreak("token-1"))
      const onDeleteRide = vi.fn().mockResolvedValue(false)
      const oneTime = ride({ type: "one-time", date: "2026-10-05", exceptions: [] })
      renderView(oneTime, onDeleteRide)

      fireEvent.click(await screen.findByRole("button", { name: "Otkazi polazak 2026-10-05 u 09:00" }))

      await waitFor(() => expect(onDeleteRide).toHaveBeenCalledWith(oneTime))
      expect(await screen.findByText("3 putnika ostaju na otkazanom polasku.")).toBeTruthy()
      expect(api.departuresControllerCancel).toHaveBeenCalledWith("dep-9", expect.anything())
    })

    it("deletes nothing and cancels nothing when the ride's departures cannot be read", async () => {
      serve([departure({ id: "dep-9", serviceDate: "2026-10-05" })])
      const onDeleteRide = vi.fn()
      renderView(ride({ type: "one-time", date: "2026-10-05", exceptions: [] }), onDeleteRide)
      const cancel = await screen.findByRole("button", { name: "Otkazi polazak 2026-10-05 u 09:00" })

      api.departuresControllerList.mockRejectedValue(new Error("Network Error"))
      fireEvent.click(cancel)

      await waitFor(() =>
        expect(toast.error).toHaveBeenCalledWith("Polasci voznje nisu mogli biti ucitani. Pokusajte ponovo.")
      )
      expect(onDeleteRide).not.toHaveBeenCalled()
      expect(api.departuresControllerCancel).not.toHaveBeenCalled()
    })

    it("marks the extra bus of two that leave at the same time", async () => {
      serve([
        departure({ id: "dep-9", serviceDate: "2026-10-05" }),
        departure({ id: "extra-1", source: "EXTRA", serviceDate: "2026-10-05" }),
      ])
      renderView()

      await screen.findByRole("button", { name: "Izmeni dodatni polazak 2026-10-05 u 09:00" })
      expect(screen.getAllByText("Dodatni")).toHaveLength(1)
    })

    it("cancels an extra bus of a one-time ride instead of deleting the ride", async () => {
      serve([departure({ id: "extra-1", source: "EXTRA", serviceDate: "2026-10-05", departureTime: "15:00" })])
      api.departuresControllerCancel.mockResolvedValue(ok())
      const onDeleteRide = vi.fn()
      renderView(ride({ type: "one-time", date: "2026-10-05" }), onDeleteRide)

      fireEvent.click(await screen.findByRole("button", { name: "Otkazi polazak 2026-10-05 u 15:00" }))

      await waitFor(() => expect(api.departuresControllerCancel).toHaveBeenCalledWith("extra-1", expect.anything()))
      expect(onDeleteRide).not.toHaveBeenCalled()
    })

    it("adds an extra bus with its date, times and capacity", async () => {
      serve([])
      api.departuresControllerCreateExtra.mockResolvedValue({ status: 201, data: departure() })
      renderView()

      fireEvent.click(await screen.findByRole("button", { name: /Dodaj dodatni polazak/ }))
      fireEvent.change(screen.getByLabelText("Datum"), { target: { value: "2026-10-07" } })
      fireEvent.change(screen.getByLabelText("Vreme polaska"), { target: { value: "15:00" } })
      fireEvent.change(screen.getByLabelText("Vreme dolaska"), { target: { value: "16:30" } })
      fireEvent.change(screen.getByLabelText("Kapacitet"), { target: { value: "30" } })
      fireEvent.click(screen.getByRole("button", { name: "Dodaj" }))

      await waitFor(() =>
        expect(api.departuresControllerCreateExtra).toHaveBeenCalledWith({
          rideId: "ride-1",
          serviceDate: "2026-10-07",
          departureTime: "15:00",
          arrivalTime: "16:30",
          capacity: 30,
        })
      )
      await waitFor(() => expect(screen.queryByLabelText("Datum")).toBeNull())
    })

    it("refuses an extra with equal times or a date past the horizon before sending it", async () => {
      serve([])
      renderView()

      fireEvent.click(await screen.findByRole("button", { name: /Dodaj dodatni polazak/ }))
      fireEvent.change(screen.getByLabelText("Vreme polaska"), { target: { value: "15:00" } })
      fireEvent.change(screen.getByLabelText("Vreme dolaska"), { target: { value: "15:00" } })
      fireEvent.click(screen.getByRole("button", { name: "Dodaj" }))

      expect((await screen.findByRole("alert")).textContent).toContain("ne mogu biti isti")

      fireEvent.change(screen.getByLabelText("Vreme dolaska"), { target: { value: "16:00" } })
      fireEvent.change(screen.getByLabelText("Datum"), { target: { value: "2027-10-04" } })
      fireEvent.click(screen.getByRole("button", { name: "Dodaj" }))

      expect((await screen.findByRole("alert")).textContent).toContain("2026-10-03 do 2027-10-03")
      expect(api.departuresControllerCreateExtra).not.toHaveBeenCalled()
    })

    it("keeps the form open with the server's sentence when an extra is refused", async () => {
      serve([])
      api.departuresControllerCreateExtra.mockRejectedValue(
        refusal("BAD_REQUEST", "Datum 2026-10-07 je van dozvoljenog opsega.", 400)
      )
      renderView()

      fireEvent.click(await screen.findByRole("button", { name: /Dodaj dodatni polazak/ }))
      fireEvent.change(screen.getByLabelText("Datum"), { target: { value: "2026-10-07" } })
      fireEvent.change(screen.getByLabelText("Vreme polaska"), { target: { value: "15:00" } })
      fireEvent.change(screen.getByLabelText("Vreme dolaska"), { target: { value: "16:30" } })
      fireEvent.click(screen.getByRole("button", { name: "Dodaj" }))

      await waitFor(() =>
        expect(toast.error).toHaveBeenCalledWith("Datum 2026-10-07 je van dozvoljenog opsega.")
      )
      expect(screen.getByLabelText("Datum")).toBeTruthy()
    })

    it("sends only the changed fields of an edited extra, and asks before moving its passengers", async () => {
      serve([
        departure({
          id: "extra-1",
          source: "EXTRA",
          serviceDate: "2026-10-05",
          departureTime: "15:00",
          arrivalTime: "16:30",
          capacity: 40,
          activeReservationCount: 3,
        }),
      ])
      api.departuresControllerUpdateExtra
        .mockRejectedValueOnce(wouldBreak("token-2"))
        .mockResolvedValueOnce(ok())
      renderView()

      fireEvent.click(await screen.findByRole("button", { name: "Izmeni dodatni polazak 2026-10-05 u 15:00" }))
      expect(screen.queryByLabelText("Datum")).toBeNull()
      fireEvent.change(screen.getByLabelText("Vreme polaska"), { target: { value: "15:30" } })
      fireEvent.click(screen.getByRole("button", { name: "Sacuvaj" }))

      expect(await screen.findByText("3 putnika ostaju na otkazanom polasku.")).toBeTruthy()
      expect(api.departuresControllerUpdateExtra).toHaveBeenLastCalledWith("extra-1", {
        departureTime: "15:30",
        confirmationTokens: [],
        repairTokens: [],
      })

      fireEvent.click(screen.getByRole("button", { name: /Ipak sacuvaj/ }))

      await waitFor(() =>
        expect(api.departuresControllerUpdateExtra).toHaveBeenLastCalledWith("extra-1", {
          departureTime: "15:30",
          confirmationTokens: ["token-2"],
          repairTokens: [],
        })
      )
      await waitFor(() => expect(screen.queryByLabelText("Vreme polaska")).toBeNull())
    })

    it("offers to delete only an extra nobody is booked on, and only a timetable bus can not be edited", async () => {
      serve([
        departure({ id: "dep-1", serviceDate: "2026-10-05" }),
        departure({ id: "extra-free", source: "EXTRA", serviceDate: "2026-10-05", departureTime: "15:00" }),
        departure({
          id: "extra-booked",
          source: "EXTRA",
          serviceDate: "2026-10-05",
          departureTime: "18:00",
          activeReservationCount: 2,
        }),
      ])
      api.departuresControllerDeleteExtra.mockResolvedValue(ok())
      renderView()

      await screen.findByRole("button", { name: "Otkazi polazak 2026-10-05 u 18:00" })
      expect(screen.queryByRole("button", { name: /Izmeni dodatni polazak 2026-10-05 u 09:00/ })).toBeNull()
      expect(screen.queryByRole("button", { name: /Obrisi dodatni polazak 2026-10-05 u 09:00/ })).toBeNull()
      expect(screen.queryByRole("button", { name: /Obrisi dodatni polazak 2026-10-05 u 18:00/ })).toBeNull()

      fireEvent.click(screen.getByRole("button", { name: "Obrisi dodatni polazak 2026-10-05 u 15:00" }))
      fireEvent.click(await screen.findByRole("button", { name: /Obriši/ }))

      await waitFor(() => expect(api.departuresControllerDeleteExtra).toHaveBeenCalledWith("extra-free"))
    })
  })
})
