import { useState } from "react"
import { act, render, renderHook, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { format } from "date-fns"
import { ReservationReturnTicketSection } from "@/components/reservations/ReservationReturnTicketSection"
import { useReservationReturnSync } from "@/hooks/useReservationReturnSync"
import { toDepartureInstance } from "@/infrastructure/mappers/departureMappers"
import type { RideInstance } from "@/types"
import { departure } from "./fixtures"

function returnBus(id: string, serviceDate: string, departureTime: string): RideInstance {
  return toDepartureInstance(
    departure({ id, rideId: "ride-2", serviceDate, departureTime, arrivalTime: "23:00" })
  )
}

const early = returnBus("dep-early", "2026-10-07", "06:00")
const late = returnBus("dep-late", "2026-10-07", "17:00")
const nextDay = returnBus("dep-next", "2026-10-08", "08:00")

/** The return picker's state as ReservationModal holds it. */
function useReturnPicker(returnRideInstances: RideInstance[]) {
  const [selectedReturnDate, setSelectedReturnDate] = useState<Date | undefined>()
  const [selectedReturnRideInstanceId, setSelectedReturnRideInstanceId] = useState("")
  const selectedReturnDateKey = selectedReturnDate ? format(selectedReturnDate, "yyyy-MM-dd") : ""

  useReservationReturnSync({
    open: true,
    reservation: null,
    returnRideInstances,
    allReservations: {},
    existingReturnReservation: null,
    isReturnTicket: true,
    selectedReturnDate,
    selectedReturnDateKey,
    selectedReturnRideInstanceId,
    returnInstancesForSelectedDate: returnRideInstances.filter(
      (instance) => instance.date === selectedReturnDateKey
    ),
    setExistingReturnReservation: vi.fn(),
    setIsReturnTicket: vi.fn(),
    setSelectedReturnRideInstanceId,
    setSelectedReturnDate,
  })

  return { selectedReturnRideInstanceId, setSelectedReturnRideInstanceId, setSelectedReturnDate }
}

describe("useReservationReturnSync", () => {
  it("keeps a chosen return bus that stopped running instead of moving to the next one that day", () => {
    const { result, rerender } = renderHook(({ buses }) => useReturnPicker(buses), {
      initialProps: { buses: [early, late, nextDay] },
    })

    act(() => result.current.setSelectedReturnRideInstanceId("dep-late"))
    expect(result.current.selectedReturnRideInstanceId).toBe("dep-late")

    // The return leg was refused and the refetch no longer lists the 17:00 bus.
    rerender({ buses: [early, nextDay] })

    expect(result.current.selectedReturnRideInstanceId).toBe("dep-late")
  })

  it("still takes the first bus of a newly chosen date", () => {
    const { result } = renderHook(({ buses }) => useReturnPicker(buses), {
      initialProps: { buses: [early, late, nextDay] },
    })

    expect(result.current.selectedReturnRideInstanceId).toBe("dep-early")

    act(() => result.current.setSelectedReturnDate(new Date("2026-10-08T00:00:00")))

    expect(result.current.selectedReturnRideInstanceId).toBe("dep-next")
  })
})

describe("ReservationReturnTicketSection", () => {
  it("asks for another return bus when the chosen one is gone", () => {
    render(
      <ReservationReturnTicketSection
        isReturnTicket
        onReturnTicketChange={vi.fn()}
        returnRideInstancesCount={1}
        returnDatePickerOpen={false}
        onReturnDatePickerOpenChange={vi.fn()}
        selectedReturnDate={new Date("2026-10-07T00:00:00")}
        onSelectReturnDate={vi.fn()}
        availableReturnDateKeys={new Set(["2026-10-07"])}
        selectedReturnRideInstanceId="dep-late"
        onSelectReturnRideInstance={vi.fn()}
        returnInstancesForSelectedDate={[early]}
        selectedReturnRideInstance={null}
        selectedArrivalStationName="Beograd"
        selectedDepartureStationName="Novi Sad"
        returnSeatPreviewNumbers={[3]}
        hasExistingReturnReservation={false}
      />
    )

    expect(screen.getByRole("alert").textContent).toBe(
      "Izabrani povratni polazak vise nije dostupan. Izaberite drugi polazak."
    )
  })
})
