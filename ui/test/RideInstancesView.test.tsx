import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { departure, ride } from "./fixtures"
import { createQueryWrapper } from "./queryWrapper"

const api = vi.hoisted(() => ({
  departuresControllerList: vi.fn(),
  departuresControllerGetById: vi.fn(),
}))

vi.mock("@/infrastructure/generated/surp-api", () => api)
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }))

import { RideInstancesView } from "@/components/rides/RideInstancesView"

function renderView() {
  return render(
    <RideInstancesView
      open
      onOpenChange={vi.fn()}
      ride={ride({ daysOfWeek: [1] })}
      loading={false}
      onCancelInstance={vi.fn()}
    />,
    { wrapper: createQueryWrapper() }
  )
}

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
    api.departuresControllerList.mockReset()
  })

  afterEach(() => {
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
})
